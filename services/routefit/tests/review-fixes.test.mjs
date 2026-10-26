import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {vehicleReasons,assertPromiseWindows,offerTtlSeconds,revokeOffersForCancelledOrder} from '../adapters/dispatch.mjs';
import {writeOrderCancel} from '../adapters/orders.mjs';
import {writeDriverSync,writeDriverLocations} from '../adapters/driver.mjs';
import {apiServer,rateLimit,databaseConflict,mergeDocumentPages} from '../application/http.mjs';

const companyId='11111111-1111-4111-8111-111111111111',driverId='22222222-2222-4222-8222-222222222222',deviceId='33333333-3333-4333-8333-333333333333',assignmentId='44444444-4444-4444-8444-444444444444',orderId='55555555-5555-4555-8555-555555555555',personId='66666666-6666-4666-8666-666666666666',executionId='77777777-7777-4777-8777-777777777777',evidenceId='88888888-8888-4888-8888-888888888888';
const principal={companyId,principalId:driverId};
const ok=(rows=[])=>({rows,rowCount:rows.length});

// ---- vehicle door clearance -------------------------------------------------
const van={state:'available',maxPayloadKg:1000,internalLengthCm:300,internalWidthCm:150,internalHeightCm:150,doorWidthCm:120,doorHeightCm:80};
const cargo=(over={})=>({order:{id:orderId},items:[{lengthCm:100,widthCm:70,heightCm:110,weightKg:10,quantity:1,restrictions:[],rotationAllowed:false,...over}]});
test('fixed-orientation cargo is checked against door width and height, not min/max of the door',()=>{
 // 110cm tall cannot pass an 80cm-high door even though 70<=80 and 110<=120 (old min/max comparison let it through)
 assert.ok(vehicleReasons(cargo(),van).includes('CARGO_DOOR_CLEARANCE_EXCEEDED'));
 // 100cm wide, 50cm tall fits a 120x80 door even though 100>80 (old comparison rejected it)
 assert.ok(!vehicleReasons(cargo({widthCm:100,heightCm:50}),van).includes('CARGO_DOOR_CLEARANCE_EXCEEDED'));
 assert.deepEqual(vehicleReasons(cargo({widthCm:120,heightCm:80}),van),[]);
 assert.ok(vehicleReasons(cargo({widthCm:121,heightCm:80}),van).includes('CARGO_DOOR_CLEARANCE_EXCEEDED'));
});
test('rotatable cargo may present its two smallest sides to the door',()=>{
 assert.deepEqual(vehicleReasons(cargo({lengthCm:200,widthCm:60,heightCm:100,rotationAllowed:true}),van),[]);
 assert.ok(vehicleReasons(cargo({lengthCm:200,widthCm:90,heightCm:100,rotationAllowed:true}),van).includes('CARGO_DOOR_CLEARANCE_EXCEEDED'));
});

// ---- promise windows --------------------------------------------------------
const win=(start,end)=>({start,end});
test('promise windows must be ordered and the reservation range must not be empty',()=>{
 const a=win('2026-10-24T03:00:00Z','2026-10-24T04:00:00Z'),b=win('2026-10-24T05:00:00Z','2026-10-24T06:00:00Z');
 assertPromiseWindows(a,b);
 assert.throws(()=>assertPromiseWindows(win('2026-10-24T04:00:00Z','2026-10-24T03:00:00Z'),b),{code:'PROMISE_WINDOW_INVALID',status:422});
 assert.throws(()=>assertPromiseWindows(a,win('2026-10-24T06:00:00Z','2026-10-24T05:00:00Z')),{code:'PROMISE_WINDOW_INVALID'});
 // pickup 15:00-16:00, delivery 10:00-12:00 would make tstzrange(15:00,12:00) fail with a 500
 assert.throws(()=>assertPromiseWindows(win('2026-10-24T15:00:00Z','2026-10-24T16:00:00Z'),win('2026-10-24T10:00:00Z','2026-10-24T12:00:00Z')),{code:'PROMISE_WINDOW_INVALID'});
 assert.throws(()=>assertPromiseWindows(a,undefined),{code:'PROMISE_WINDOW_INVALID'});
 assert.throws(()=>assertPromiseWindows(win('x','y'),b),{code:'PROMISE_WINDOW_INVALID'});
});

// ---- offer TTL --------------------------------------------------------------
test('offer lifetime follows the service level (PILOT-0 candidate: S1 60s, others 120s)',()=>{
 assert.equal(offerTtlSeconds('S1'),60);
 for(const level of ['S2','S3','S4'])assert.equal(offerTtlSeconds(level),120);
});

// ---- offline sync sequence --------------------------------------------------
function syncClient(startSequence){
 const stored=new Map();let sequence=startSequence;const updates=[];
 return {stored,updates,get sequence(){return sequence;},query:async(sql,params=[])=>{
  if(sql.includes('SELECT kind,person_id FROM org.principal'))return ok([{kind:'DRIVER',person_id:personId}]);
  if(sql.includes('SELECT device_id,fingerprint,result,resource_id')){const row=stored.get(params[1]);return ok(row?[row]:[]);}
  if(sql.includes('FROM mobile.device d JOIN mobile.shift'))return ok([{ok:1}]);
  if(sql.includes('INSERT INTO mobile.sync_device_state'))return ok();
  if(sql.includes('SELECT last_sequence FROM mobile.sync_device_state'))return ok([{last_sequence:sequence}]);
  if(sql.includes('SELECT a.*,pv.plan_version FROM dispatch.assignment'))return ok([{id:assignmentId,order_id:orderId,version:1,plan_version:1}]);
  if(sql.includes('count(*)::integer AS count FROM evidence.file'))return ok([{count:0}]);
  if(sql.includes('INSERT INTO mobile.sync_event')){stored.set(params[1],{device_id:params[2],fingerprint:params[8],result:params[9],resource_id:params[10],resource_version:params[11],error_code:params[12]});return ok([{}]);}
  if(sql.includes('UPDATE mobile.sync_device_state SET last_sequence')){sequence=params[2];updates.push(params[2]);return ok([{}]);}
  return ok();
 }};
}
const arrived=(eventId,sequence)=>({eventId,sequence,assignmentId,assignmentVersion:1,planVersion:1,observedAt:new Date().toISOString(),type:'ARRIVED',payload:{point:{lat:11.55,lng:104.92},evidenceFileIds:[]}});
const id=n=>`aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12,'0')}`;
test('an out-of-order sync event is reported but neither stored nor allowed to move the device sequence',async()=>{
 const db=syncClient(1);
 const early=await writeDriverSync(db,principal,{deviceId,events:[arrived(id(3),3)]});
 assert.deepEqual(early.results[0],{eventId:id(3),result:'REJECTED',resourceId:null,resourceVersion:null,errorCode:'SYNC_SEQUENCE_INVALID'});
 assert.equal(db.stored.size,0,'a sequence rejection must not be persisted');
 assert.equal(db.sequence,1,'last_sequence must not jump to the rejected event');
 assert.deepEqual(db.updates,[]);
});
test('after an out-of-order arrival the device can still deliver 2 then resend 3 in order',async()=>{
 const db=syncClient(1);
 await writeDriverSync(db,principal,{deviceId,events:[arrived(id(3),3)]});
 const second=await writeDriverSync(db,principal,{deviceId,events:[arrived(id(2),2)]});
 assert.equal(second.results[0].result,'APPLIED');assert.equal(db.sequence,2);
 const third=await writeDriverSync(db,principal,{deviceId,events:[arrived(id(3),3)]});
 assert.equal(third.results[0].result,'APPLIED','the resent event must be accepted, not answered with a stored rejection');
 assert.equal(db.sequence,3);
});
test('a whole batch sent out of order is applied up to the gap and the rest is retried later',async()=>{
 const db=syncClient(0);
 const batch=await writeDriverSync(db,principal,{deviceId,events:[arrived(id(1),1),arrived(id(3),3),arrived(id(2),2)]});
 assert.deepEqual(batch.results.map(r=>[r.eventId,r.result,r.errorCode]),[[id(1),'APPLIED',null],[id(3),'REJECTED','SYNC_SEQUENCE_INVALID'],[id(2),'APPLIED',null]]);
 assert.equal(db.sequence,2);
 const retry=await writeDriverSync(db,principal,{deviceId,events:[arrived(id(3),3)]});assert.equal(retry.results[0].result,'APPLIED');
});

// ---- location upload outside the authorised shift ---------------------------
function locationClient(shift){
 const inserted=[];
 return {inserted,query:async(sql,params=[])=>{
  if(sql.includes('SELECT kind,person_id FROM org.principal'))return ok([{kind:'DRIVER',person_id:personId}]);
  if(sql.includes('FROM mobile.shift s JOIN mobile.device d'))return ok(shift?[shift]:[]);
  if(sql.includes('INSERT INTO mobile.location_event')){inserted.push(params[3]);return ok([{observed_at:params[4]}]);}
  return ok();
 }};
}
test('location points observed outside the authorised shift are rejected even when uploaded during a later shift',async()=>{
 const now=Date.now(),iso=ms=>new Date(now+ms).toISOString();
 const db=locationClient({starts_at:iso(-3600000),ends_at:iso(3600000)});
 const point=(clientPointId,ms)=>({clientPointId,observedAt:iso(ms),point:{lat:11.55,lng:104.92},accuracyM:5,permission:'ALWAYS',foreground:true,batteryRatio:0.5});
 const result=await writeDriverLocations(db,principal,{deviceId,shiftId:id(9),points:[point('before-shift',-7200000),point('in-shift',-60000),point('after-shift',7200000),point('future',600000)]});
 assert.deepEqual(result.acceptedPointIds,['in-shift']);
 assert.deepEqual(result.rejectedPointIds.sort(),['after-shift','before-shift','future']);
 assert.deepEqual(db.inserted,['in-shift'],'rejected points must never reach the database');
 await assert.rejects(()=>writeDriverLocations(locationClient(null),principal,{deviceId,shiftId:id(9),points:[point('p',0)]}),{code:'LOCATION_SHIFT_NOT_ACTIVE'});
});

// ---- cancelling an order withdraws its open offer ---------------------------
function cancelClient({carrier=false,assignments}){
 const calls=[];
 return {calls,query:async(sql,params=[])=>{
  calls.push({sql,params});
  if(sql.startsWith('SELECT snapshot FROM orders.draft'))return ok([{snapshot:{order:{id:orderId,version:3,state:'awaiting_dispatch',promiseId:id(5),serviceLevel:'S2'}}}]);
  if(sql.includes('finance.allocation_reversal'))return ok();
  if(sql.includes('finance.prepayment_receipt'))return ok([{reported:'0'}]);
  if(sql.includes('count(*)::integer AS count FROM evidence.file'))return ok([{count:1}]);
  if(sql.startsWith('SELECT person_id FROM org.principal'))return ok([{person_id:personId}]);
  if(sql.includes("kind='CARRIER'"))return ok(carrier?[{}]:[]);
  if(sql.includes('FROM dispatch.assignment a JOIN dispatch.route_plan_version'))return ok(assignments);
  if(sql.startsWith('UPDATE dispatch.capacity_reservation'))return {rows:[],rowCount:1};
  return {rows:[],rowCount:1};
 }};
}
const offered=(state='offered')=>({id:assignmentId,version:1,order_id:orderId,vehicle_id:id(6),driver_id:driverId,state,expires_at:new Date(Date.now()+60000),plan_version:1,execution_id:executionId,snapshot:{}});
const cancelBody={reason:' customer called ',evidenceFileIds:[evidenceId]};
test('cancelling an order revokes its offered assignment and ends the active execution before cancelling',async()=>{
 const db=cancelClient({assignments:[offered()]});
 await writeOrderCancel(db,principal,orderId,cancelBody,3);
 const find=prefix=>db.calls.findIndex(c=>c.sql.startsWith(prefix));
 const revoke=db.calls.find(c=>c.sql.startsWith('UPDATE dispatch.assignment SET state'));
 assert.ok(revoke,'assignment must be transitioned');assert.equal(revoke.params[2],'revoked');assert.equal(revoke.params[3],2);
 assert.equal(revoke.params[4].cause,'ORDER_CANCELLED');assert.equal(revoke.params[4].reason,'customer called');
 const event=db.calls.find(c=>c.sql.startsWith('INSERT INTO dispatch.assignment_event'));assert.equal(event.params[3],'REVOKED');
 const end=db.calls.find(c=>c.sql.includes("UPDATE dispatch.fulfillment_execution SET state='ENDED'"));
 assert.deepEqual([end.params[1],end.params[2]],[executionId,'ORDER_CANCELLED']);
 assert.ok(find('UPDATE dispatch.assignment SET state')<find('UPDATE orders.draft'),'offers are withdrawn before the order snapshot changes');
});
test('cancelling an order with no open offer changes no assignment',async()=>{
 const db=cancelClient({assignments:[]});await writeOrderCancel(db,principal,orderId,cancelBody,3);
 assert.ok(!db.calls.some(c=>c.sql.startsWith('UPDATE dispatch.assignment')));
 assert.ok(db.calls.some(c=>c.sql.startsWith('UPDATE orders.draft')));
});
test('an order with an active carrier booking or an accepted assignment cannot be cancelled silently',async()=>{
 const carrier=cancelClient({carrier:true,assignments:[]});
 await assert.rejects(()=>writeOrderCancel(carrier,principal,orderId,cancelBody,3),{code:'CARRIER_BOOKING_ACTIVE',status:409});
 assert.ok(!carrier.calls.some(c=>c.sql.startsWith('UPDATE orders.draft')),'the order must stay as it was');
 const accepted=cancelClient({assignments:[offered('accepted')]});
 await assert.rejects(()=>revokeOffersForCancelledOrder(accepted,principal,orderId,{reason:'x',evidenceFileIds:[]}),{code:'ASSIGNMENT_ACCEPTED'});
});

// ---- finance document pagination -------------------------------------------
test('merged finance document pages never drop rows when the sources together exceed the limit',()=>{
 const rows=(prefix,n)=>Array.from({length:n},(_,i)=>({id:`${prefix}${String(i).padStart(3,'0')}`}));
 const page={limit:50,cursor:value=>'cursor:'+value};
 const legacy={items:rows('a',30),nextCursor:null},workflow={items:rows('b',30),nextCursor:null};
 const first=mergeDocumentPages(legacy,workflow,page);
 assert.equal(first.items.length,50);
 assert.equal(first.nextCursor,'cursor:'+first.items.at(-1).id,'10 rows were cut off, so a next page must be advertised');
 // walk the pages the way a client does: each source returns the rows after the cursor, capped at limit
 const all=[...rows('a',30),...rows('b',30)].sort((x,y)=>x.id.localeCompare(y.id)),seen=[];let after=null,guard=0;
 do{
  const take=list=>{const rest=list.filter(r=>after===null||r.id>after);return {items:rest.slice(0,page.limit),nextCursor:rest.length>page.limit?'more':null};};
  const result=mergeDocumentPages(take(all.filter(r=>r.id.startsWith('a'))),take(all.filter(r=>r.id.startsWith('b'))),page);
  seen.push(...result.items.map(r=>r.id));after=result.nextCursor?result.nextCursor.slice('cursor:'.length):null;
 }while(after&&++guard<10);
 assert.deepEqual(seen,all.map(r=>r.id),'every document is reachable exactly once');
 const small=mergeDocumentPages({items:rows('a',3),nextCursor:null},{items:rows('b',2),nextCursor:null},page);
 assert.equal(small.items.length,5);assert.equal(small.nextCursor,null);
 assert.equal(mergeDocumentPages({items:[],nextCursor:null},{items:[],nextCursor:null},page).nextCursor,null);
});

// ---- rate limiter -----------------------------------------------------------
test('rate limiter enforces the window and purges expired keys so one-off clients do not accumulate',()=>{
 const table=new Map(),t0=1_000_000;
 for(let i=0;i<3;i++)rateLimit(table,'client',3,t0+i);
 assert.throws(()=>rateLimit(table,'client',3,t0+10),{code:'RATE_LIMITED',status:429});
 rateLimit(table,'client',3,t0+60000);
 const many=new Map();for(let i=0;i<1500;i++)rateLimit(many,'ip-'+i,60,t0);
 assert.equal(many.size,1500);
 rateLimit(many,'late-client',60,t0+120000);
 assert.equal(many.size,1,'expired windows are removed once the table is large');
});

// ---- database conflicts and error logging over HTTP -------------------------
test('exclusion and unique violations map to business conflicts',()=>{
 assert.deepEqual(databaseConflict({code:'23P01'}).code,'CAPACITY_CONFLICT');
 assert.deepEqual(databaseConflict({code:'23505'}).code,'REQUEST_CONFLICT');
 assert.equal(databaseConflict({code:'22000'}),null);assert.equal(databaseConflict(new Error('x')),null);
});
test('HTTP maps a database exclusion violation to 409 and logs the cause of an unexpected 500',async()=>{
 const entries=[];let failure;
 const pool={connect:async()=>({release(){},query:async sql=>{if(sql.includes('FROM org.principal p JOIN org.company c'))throw failure;return ok();}})};
 const server=apiServer({pool,authenticate:()=>({companyId,principalId:driverId,permissions:['session:read']}),log:entry=>entries.push(entry)});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 try{
  const call=()=>fetch(`http://127.0.0.1:${server.address().port}/api/ops/v1/session`);
  failure=Object.assign(new Error('conflicting key value violates exclusion constraint "capacity_reservation_vehicle_window_excl"'),{code:'23P01',constraint:'capacity_reservation_vehicle_window_excl'});
  let response=await call(),body=await response.json();
  assert.equal(response.status,409);assert.equal(body.error.code,'CAPACITY_CONFLICT');assert.equal(body.error.retryable,false);
  assert.equal(entries.at(-1).status,409);assert.equal(entries.at(-1).cause,undefined);
  failure=Object.assign(new RangeError('range lower bound must be less than or equal to range upper bound'),{code:'22000'});
  response=await call();body=await response.json();
  assert.equal(response.status,500);assert.equal(body.error.code,'INTERNAL_ERROR');
  assert.ok(!JSON.stringify(body).includes('range lower bound'),'internal messages are not returned to the client');
  assert.deepEqual(entries.at(-1).cause,{name:'RangeError',code:'22000',constraint:null,message:'range lower bound must be less than or equal to range upper bound'});
  assert.equal(entries.at(-1).requestId,body.error.requestId,'the log entry is traceable by the returned requestId');
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
