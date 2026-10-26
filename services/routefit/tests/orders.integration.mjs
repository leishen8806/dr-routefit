import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {once} from 'node:events';
import {readFile} from 'node:fs/promises';
import pg from 'pg';
import {localFixture} from '../db/local-fixture.mjs';
import {apiServer} from '../application/http.mjs';
import {developmentAuth,digest,developmentPermissions} from '../adapters/development-auth.mjs';
import {transaction} from '../adapters/postgres.mjs';
import {validate} from '../adapters/contract.mjs';

if(!process.env.ROUTEFIT_TEST_DATABASE_URL)throw Error('ROUTEFIT_TEST_DATABASE_URL is required');
test('real PostgreSQL order-draft HTTP integration',async t=>{
 const f=await localFixture(process.env.ROUTEFIT_TEST_DATABASE_URL);
 const ungranted={companyId:f.principals[0].companyId,principalId:randomUUID()};
 await f.owner.query("INSERT INTO org.principal(id,company_id,kind,display_name,idp_subject,status) VALUES($1,$2,'STAFF','DEMO ungranted',$3,'ACTIVE')",[ungranted.principalId,ungranted.companyId,'local:'+ungranted.principalId]);
 const actors=[...f.principals,ungranted,{...f.principals[0],readonly:true}].map(a=>({...a,token:randomBytes(32).toString('hex'),csrf:randomBytes(32).toString('hex')}));
 let pool,server,origin;
 async function start(){
  pool=new pg.Pool({connectionString:f.runtimeUrl,max:5});let auth;
  server=apiServer({pool,authenticate:r=>auth(r)});server.listen(0,'127.0.0.1');await once(server,'listening');origin=`http://127.0.0.1:${server.address().port}`;
  auth=developmentAuth(actors.map(a=>({...a,tokenHash:digest(a.token),csrfHash:digest(a.csrf),permissions:a.readonly?['orders:read']:developmentPermissions,expiresAt:new Date(Date.now()+600000).toISOString()})),origin);
 }
 async function stop(){server?.closeAllConnections();if(server)await new Promise(resolve=>server.close(resolve));await pool?.end();server=null;pool=null;}
 async function request(path,{body,method=body?'POST':'GET',version,key=randomUUID(),actor=0,headers={}}={}){
  const a=actors[actor];const r=await fetch(origin+'/api/ops/v1'+path,{method,headers:{Cookie:'rf_session='+a.token,Origin:origin,'X-CSRF-Token':a.csrf,'Content-Type':'application/json','Idempotency-Key':key,...(version?{'If-Match':`"${version}"`}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
  const data=await r.json();validate(r.ok?(path==='/session'?'Session':path.includes('/timeline')?'TimelineEventPage':path.startsWith('/customers')?'OrderCustomerPage':data.order?'OrderDetail':'OrderSummaryPage'):'ApiError',data);return {status:r.status,data,headers:r.headers};
 }
 async function customerRequest(path,{body,method=body?'POST':'GET',version,key=randomUUID(),actor=0}={}){
  const a=actors[actor],r=await fetch(origin+'/api/customer/v1'+path,{method,headers:{Cookie:'rf_session='+a.token,Origin:origin,'X-CSRF-Token':a.csrf,'Content-Type':'application/json','Idempotency-Key':key,...(version?{'If-Match':`"${version}"`}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const data=await r.json();validate(r.ok?'CustomerOrderDetail':'ApiError',data);return {status:r.status,data,headers:r.headers};
 }
 const draft={...JSON.parse(await readFile(new URL('../../../contracts/examples/order-draft.json',import.meta.url),'utf8')),customerId:f.customers[0]};
 let order,initial,key=randomUUID();
 try{
  await start();
  await t.test('internal session returns only the authenticated principal projection',async()=>{
   const session=await request('/session');assert.equal(session.status,200);assert.equal(session.data.actor.id,actors[0].principalId);assert.equal(session.data.actor.operatingCompanyId,actors[0].companyId);
   assert.equal((await request('/session',{actor:3})).status,403);
  });
  await t.test('authorized customers, persistent create, replay and forbidden spoofing',async()=>{
   assert.deepEqual((await request('/customers')).data.items.map(x=>x.id),[f.customers[0]]);
   assert.equal((await request('/customers',{actor:2})).data.items.length,0);
   assert.equal((await request('/orders',{body:draft,actor:3})).status,403);
   assert.equal((await request('/orders',{body:{...draft,paid:true}})).status,422);
   assert.equal((await request('/orders',{body:{...draft,customerId:f.customers[1]}})).status,404);
   assert.equal((await request('/orders',{body:draft,headers:{'X-CSRF-Token':''}})).status,403);
   const results=await Promise.all([request('/orders',{body:draft,key}),request('/orders',{body:draft,key})]);assert.deepEqual(results.map(x=>x.status),[201,201]);assert.deepEqual(results[0].data,results[1].data);
   assert.deepEqual(results.map(x=>x.headers.get('Idempotent-Replayed')).sort(),['false','true']);order=initial=results[0].data;
   assert.deepEqual(order.draft,draft);assert.equal(order.order.collectionState,'unpaid');assert.equal(order.quoteId,null);assert.equal(order.order.state,'draft');assert.equal(order.items[0].packageIds.length,1);
   assert.equal((await request('/orders',{body:{...draft,notes:'changed'},key})).status,409);
  });
  await t.test('operations timeline only projects stored facts to authorized readers',async()=>{
   const timeline=await request('/orders/'+order.order.id+'/timeline');assert.equal(timeline.status,200);assert.deepEqual(timeline.data.items.map(item=>item.type),['ORDER_RECORDED']);assert.equal(timeline.data.nextCursor,null);
   assert.equal((await request('/orders/'+order.order.id+'/timeline?limit=0')).status,422);
   assert.equal((await request('/orders/'+order.order.id+'/timeline',{actor:1})).status,404);
  });
  await t.test('customer creates only its own controlled draft',async()=>{
   const input={...draft,pickup:{...draft.pickup,point:{lng:104.9,lat:11.5}},delivery:{...draft.delivery,point:{lng:104.9,lat:11.5}}};delete input.customerId;
   assert.equal((await customerRequest('/orders',{body:{...input,customerId:f.customers[1]}})).status,422);
   const createKey=randomUUID(),pair=await Promise.all([customerRequest('/orders',{body:input,key:createKey}),customerRequest('/orders',{body:input,key:createKey})]);assert.deepEqual(pair.map(result=>result.status),[201,201]);assert.deepEqual(pair[0].data,pair[1].data);assert.equal(pair[0].data.order.customerId,f.customers[0]);assert.equal('draft' in pair[0].data,false);assert.deepEqual(pair.map(result=>result.headers.get('Idempotent-Replayed')).sort(),['false','true']);
   const customerOrder=pair[0].data,evidenceId=randomUUID(),areaId=randomUUID(),area={name:'DEMO customer coverage',type:'ALLOW',polygon:{type:'Polygon',coordinates:[[[104.8,11.4],[105,11.4],[105,11.6],[104.8,11.6],[104.8,11.4]]]},effectiveFrom:new Date(Date.now()-1000).toISOString()};
   assert.equal((await customerRequest('/orders/'+customerOrder.order.id+'/actions/submit',{body:{},version:1})).status,422);
   await f.owner.query("INSERT INTO coverage.area(id,company_id,version,state,data,created_by) VALUES($1,$2,1,'active',$3,$4)",[areaId,actors[0].companyId,area,actors[0].principalId]);
   await f.owner.query("INSERT INTO coverage.publication(company_id,revision,area_id,area_version,snapshot,reason,principal_id) VALUES($1,1,$2,1,$3,'DEMO customer acceptance evidence',$4)",[actors[0].companyId,areaId,area,actors[0].principalId]);
   const evidence={id:evidenceId,orderId:customerOrder.order.id,orderVersion:1,recordedBy:actors[0].principalId,recordedAt:new Date().toISOString(),sourceQuality:'MANUAL_RECORDED',data:{pickup:{reference:'DEMO confirmed pickup',entrance:'DEMO pickup entrance'},delivery:{reference:'DEMO confirmed delivery',entrance:'DEMO delivery entrance'},measurements:input.items.map(item=>({clientItemId:item.clientItemId,reference:'DEMO measured package',packagingConfirmed:true}))}};
   await f.owner.query('INSERT INTO orders.intake_evidence(id,company_id,order_id,source_version,snapshot,principal_id) VALUES($1,$2,$3,1,$4,$5)',[evidenceId,actors[0].companyId,customerOrder.order.id,evidence,actors[0].principalId]);
   const submitted=await customerRequest('/orders/'+customerOrder.order.id+'/actions/submit',{body:{},version:1});assert.equal(submitted.status,200,JSON.stringify(submitted.data));assert.deepEqual([submitted.data.order.state,submitted.data.order.version],['validating',2]);
   assert.equal((await customerRequest('/orders/'+customerOrder.order.id+'/actions/submit',{actor:1,body:{},version:1})).status,404);
  });
  await t.test('company and same-company customer scopes cover reads, writes, RLS and revocation',async()=>{
   for(const actor of [1,2]){
    assert.equal((await request('/orders/'+order.order.id,{actor})).status,404);
    assert.equal((await request('/orders',{actor})).data.items.length,0);
    assert.equal((await request('/orders/'+order.order.id,{method:'PATCH',body:draft,version:1,actor})).status,404);
    assert.equal((await transaction(pool,actors[actor],c=>c.query('SELECT * FROM orders.draft'))).rowCount,0);
   }
   assert.equal((await pool.query('SELECT * FROM orders.draft')).rowCount,0);
   await f.owner.query('DELETE FROM party.customer_access WHERE principal_id=$1',[actors[0].principalId]);
   assert.equal((await request('/orders',{body:draft,key})).status,404);
   await f.owner.query('INSERT INTO party.customer_access(company_id,customer_id,principal_id) VALUES($1,$2,$3)',[actors[0].companyId,f.customers[0],actors[0].principalId]);
  });
  await t.test('draft edits preserve package identities and reject concurrent stale updates',async()=>{
   const changed={...draft,notes:'saved edit',items:[{...draft.items[0],quantity:2}]};
   const results=await Promise.all([request('/orders/'+order.order.id,{method:'PATCH',body:changed,version:1}),request('/orders/'+order.order.id,{method:'PATCH',body:{...changed,notes:'other'},version:1})]);
   assert.deepEqual(results.map(x=>x.status).sort(),[200,412]);order=results.find(x=>x.status===200).data;
   assert.equal(order.items[0].packageIds[0],initial.items[0].packageIds[0]);assert.equal(new Set(order.items[0].packageIds).size,2);assert.equal(order.order.version,2);
   const patchKey=randomUUID(),body={...order.draft,notes:'second edit'};
   const saved=await request('/orders/'+order.order.id,{method:'PATCH',body,version:2,key:patchKey});assert.equal(saved.status,200);order=saved.data;
   const replay=await request('/orders/'+order.order.id,{method:'PATCH',body,version:2,key:patchKey});assert.deepEqual(replay.data,order);assert.equal(replay.headers.get('Idempotent-Replayed'),'true');
   assert.equal((await request('/orders/'+order.order.id,{method:'PATCH',body,version:3,key:patchKey})).status,409);
   assert.equal((await request('/orders/'+order.order.id)).headers.get('etag'),'"3"');
   assert.equal((await request('/orders/'+order.order.id,{method:'PATCH',body})).status,428);
   await assert.rejects(f.owner.query('DELETE FROM orders.draft_revision'),e=>e.code==='42501');
   const history=(await f.owner.query('SELECT snapshot FROM orders.draft_revision WHERE order_id=$1 ORDER BY version',[order.order.id])).rows;assert.equal(history.length,3);assert.deepEqual(history[0].snapshot,initial);
  });
  await t.test('unsupported capabilities and incomplete measurements fail without writes',async()=>{
   const before=(await f.owner.query('SELECT count(*) FROM orders.draft')).rows[0].count;
   for(const change of [
    {paymentTerms:'APPROVED_CREDIT'}, {serviceLevel:'S4'}, {cod:{amountMinor:100,currency:'USD'}},
    {requestedPickupWindow:{start:draft.requestedPickupWindow.end,end:draft.requestedPickupWindow.start}},
    {items:[{...draft.items[0],weightKg:null}]}, {items:[draft.items[0],draft.items[0]]},
    {items:[{...draft.items[0],measurementEvidenceIds:['unverified']}]}
   ])assert.equal((await request('/orders',{body:{...draft,...change}})).status,422);
   assert.equal((await f.owner.query('SELECT count(*) FROM orders.draft')).rows[0].count,before);
   const unknown=await request('/orders',{body:{...draft,items:[{...draft.items[0],weightKg:null,unknownReason:'Awaiting measurement'}]}});assert.equal(unknown.status,201);assert.equal(unknown.data.items[0].weightKg,null);assert.equal(unknown.data.order.state,'draft');
  });
  await t.test('signed cursors, stable ordering, filters and query tampering',async()=>{
   const first=await request('/orders?limit=1');assert.equal(first.status,200);assert.ok(first.data.nextCursor);
   const cursor=encodeURIComponent(first.data.nextCursor),next=await request('/orders?limit=1&cursor='+cursor);assert.equal(next.status,200);assert.notEqual(first.data.items[0].id,next.data.items[0].id);
   for(const path of ['/orders?limit=1&cursor='+cursor+'&state=draft','/orders?limit=2&cursor='+cursor,'/orders?limit=1&cursor='+cursor+'x','/orders?limit=0','/orders?limit=1&limit=2','/orders?companyId=spoof','/orders?state=','/orders?serviceLevel='])assert.equal((await request(path)).status,422);
   assert.equal((await request('/orders?limit=1&cursor='+cursor,{actor:1})).status,422);
   assert.equal((await request('/orders?state=executing')).data.items.length,0);
  });
  await t.test('restart retains full drafts and original idempotent response',async()=>{
   await stop();await start();assert.deepEqual((await request('/orders/'+order.order.id)).data,order);
   const replay=await request('/orders',{body:draft,key});assert.deepEqual(replay.data,initial);assert.equal(replay.headers.get('Idempotent-Replayed'),'true');
  });
 }finally{await stop();await f.cleanup();}
});
