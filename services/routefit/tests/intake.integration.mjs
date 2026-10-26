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
test('real PostgreSQL intake and coverage lifecycle',async t=>{
 const f=await localFixture(process.env.ROUTEFIT_TEST_DATABASE_URL);
 const actors=[...f.principals,{...f.principals[0],readonly:true}].map(a=>({...a,token:randomBytes(32).toString('hex'),csrf:randomBytes(32).toString('hex')}));
 let pool,server,origin;
 async function start(){pool=new pg.Pool({connectionString:f.runtimeUrl,max:5});let auth;server=apiServer({pool,authenticate:r=>auth(r)});server.listen(0,'127.0.0.1');await once(server,'listening');origin=`http://127.0.0.1:${server.address().port}`;auth=developmentAuth(actors.map(a=>({...a,tokenHash:digest(a.token),csrfHash:digest(a.csrf),permissions:a.readonly?['orders:read','areas:read']:developmentPermissions,expiresAt:new Date(Date.now()+600000).toISOString()})),origin);}
 async function stop(){server?.closeAllConnections();if(server)await new Promise(r=>server.close(r));await pool?.end();server=null;pool=null;}
 async function req(path,{body,method=body?'POST':'GET',version,key=randomUUID(),actor=0}={}){
  const a=actors[actor],r=await fetch(origin+'/api/ops/v1'+path,{method,headers:{Cookie:'rf_session='+a.token,Origin:origin,'X-CSRF-Token':a.csrf,'Content-Type':'application/json','Idempotency-Key':key,...(version?{'If-Match':`"${version}"`}:{})},...(body?{body:JSON.stringify(body)}:{})}),data=await r.json();
  validate(r.ok?(data.order?'OrderDetail':data.sourceSnapshot?'OrderIntakeEvidence':data.blockers?'OrderIntakeCheck':data.data?'ServiceArea':'ServiceAreaPage'):'ApiError',data);return {status:r.status,data,replayed:r.headers.get('Idempotent-Replayed')};
 }
 const draft=JSON.parse(await readFile(new URL('../../../contracts/examples/order-draft.json',import.meta.url),'utf8'));
 draft.customerId=f.customers[0];draft.pickup.point={lng:104.9,lat:11.5};draft.delivery.point={lng:104.95,lat:11.55};
 for(const [i,k] of ['requestedPickupWindow','requestedDeliveryWindow'].entries())draft[k]={start:new Date(Date.now()+(i+1)*3600000).toISOString(),end:new Date(Date.now()+(i+2)*3600000).toISOString()};
 const input=JSON.parse(await readFile(new URL('../../../contracts/examples/order-intake.json',import.meta.url),'utf8'));
 const polygon=points=>({type:'Polygon',coordinates:[points]}),reason={reason:'DEMO controlled test'},areaDraft={name:'DEMO local city',type:'ALLOW',polygon:polygon([[104.8,11.4],[105,11.4],[105,11.6],[104.8,11.6],[104.8,11.4]]),effectiveFrom:'2026-01-01T00:00:00Z'};
 let order,area,deny,evidence,accepted,submitKey=randomUUID();const path=()=>'/orders/'+order.order.id;
 try{
  await start();
  await t.test('unpublished coverage, missing evidence and spoofed records fail closed',async()=>{
   order=(await req('/orders',{body:draft})).data;
   let check=(await req(path()+'/intake-check')).data;assert.equal(check.ready,false);assert.deepEqual(check.blockers.map(x=>x.code),['EVIDENCE_MISSING','COVERAGE_UNPUBLISHED']);
   assert.equal((await req(path()+'/actions/submit',{body:{},version:1})).status,422);
   assert.equal((await req(path()+'/intake-evidence',{body:{...input,recordedBy:actors[1].principalId},version:1})).status,422);
   assert.equal((await req(path()+'/intake-evidence',{body:input,version:1,actor:2})).status,403);
   assert.equal((await req(path()+'/intake-evidence',{body:{...input,measurements:[input.measurements[0],input.measurements[0]]},version:1})).status,422);
   const key=randomUUID(),results=await Promise.all([req(path()+'/intake-evidence',{body:input,version:1,key}),req(path()+'/intake-evidence',{body:input,version:1,key})]);
   assert.deepEqual(results.map(x=>x.status),[201,201]);assert.deepEqual(results[0].data,results[1].data);evidence=results[0].data;
   assert.equal(evidence.recordedBy,actors[0].principalId);assert.deepEqual(evidence.sourceSnapshot,draft);assert.equal(evidence.sourceQuality,'MANUAL_RECORDED');
   assert.equal((await req(path())).data.order.version,1);
  });
  await t.test('geometry limits, publication, pagination and tenant scope',async()=>{
   for(const polygonValue of [polygon([[104.8,11.4],[105,11.6],[105,11.4],[104.8,11.6],[104.8,11.4]]),{type:'Polygon',coordinates:[areaDraft.polygon.coordinates[0],areaDraft.polygon.coordinates[0]]},polygon([[104,11],[106,11],[106,12],[104,11]])])assert.equal((await req('/service-areas',{body:{...areaDraft,polygon:polygonValue}})).status,422);
   area=(await req('/service-areas',{body:areaDraft})).data;
   assert.equal((await req('/service-areas/'+area.id+'/actions/publish',{body:reason,version:1,actor:2})).status,403);
   area=(await req('/service-areas/'+area.id+'/actions/publish',{body:reason,version:1})).data;assert.equal(area.state,'active');
   assert.equal((await req('/service-areas',{actor:1})).data.items.length,0);
   assert.equal((await req('/service-areas/'+area.id+'/actions/retire',{body:reason,version:2,actor:1})).status,404);
   assert.equal((await req(path()+'/intake-check',{actor:1})).status,404);
   assert.equal((await transaction(pool,actors[1],c=>c.query('SELECT * FROM orders.intake_evidence'))).rowCount,0);
   assert.equal((await pool.query('SELECT * FROM coverage.area')).rowCount,0);
   const check=(await req(path()+'/intake-check')).data;assert.equal(check.ready,true);assert.equal(check.automationEligible,false);
  });
  await t.test('atomic submission, concurrent version conflict, replay, immutable history',async()=>{
   const results=await Promise.all([req(path()+'/actions/submit',{body:{},version:1,key:submitKey}),req(path()+'/actions/submit',{body:{},version:1})]);assert.deepEqual(results.map(x=>x.status).sort(),[200,412]);
   if(results[0].status===412)submitKey=randomUUID();
   accepted=results.find(x=>x.status===200).data;assert.equal(accepted.order.state,'validating');assert.equal(accepted.order.version,2);assert.equal(accepted.intake.evidenceId,evidence.id);assert.equal(accepted.quoteId,null);assert.equal(accepted.activeExecutionId,null);assert.equal(accepted.order.collectionState,'unpaid');
   assert.equal((await req(path(),{method:'PATCH',body:draft,version:2})).status,409);
   assert.equal((await req(path()+'/intake-evidence',{body:input,version:2})).status,409);
   await assert.rejects(f.owner.query('UPDATE orders.intake_evidence SET snapshot=\'{}\''),e=>e.code==='42501');
   await assert.rejects(f.owner.query('DELETE FROM coverage.publication'),e=>e.code==='42501');
   await assert.rejects(f.owner.query('UPDATE orders.draft SET intake_evidence_id=NULL WHERE id=$1',[order.order.id]),e=>e.code==='23514');
  });
  await t.test('new deny on boundary invalidates readiness without changing accepted facts',async()=>{
   deny=(await req('/service-areas',{body:{...areaDraft,type:'DENY',name:'DEMO denied boundary',polygon:polygon([[104.95,11.55],[104.98,11.55],[104.98,11.58],[104.95,11.58],[104.95,11.55]])}})).data;
   deny=(await req('/service-areas/'+deny.id+'/actions/publish',{body:reason,version:1})).data;
   const check=(await req(path()+'/intake-check')).data;assert.equal(check.ready,false);assert.deepEqual(check.blockers.map(x=>x.code),['COVERAGE_CHANGED','AREA_DENIED']);assert.deepEqual((await req(path())).data,accepted);
   const page=(await req('/service-areas?limit=1')).data;assert.ok(page.nextCursor);assert.notEqual((await req('/service-areas?limit=1&cursor='+encodeURIComponent(page.nextCursor))).data.items[0].id,page.items[0].id);
  });
  await t.test('return, edit, re-evidence, resubmit and revoked replay',async()=>{
   order=(await req(path()+'/actions/return-to-draft',{body:reason,version:2})).data;assert.equal(order.order.version,3);assert.equal(order.intake,undefined);
   assert.ok((await req(path()+'/intake-check')).data.blockers.some(x=>x.code==='EVIDENCE_MISSING'));
   deny=(await req('/service-areas/'+deny.id+'/actions/retire',{body:reason,version:2})).data;assert.equal(deny.state,'superseded');
   await req(path()+'/intake-evidence',{body:input,version:3});
   order=(await req(path(),{method:'PATCH',body:{...draft,notes:'DEMO changed'},version:3})).data;assert.equal(order.order.version,4);
   assert.equal((await req(path()+'/actions/submit',{body:{},version:4})).status,422);
   await req(path()+'/intake-evidence',{body:input,version:4});submitKey=randomUUID();
   accepted=(await req(path()+'/actions/submit',{body:{},version:4,key:submitKey})).data;assert.equal(accepted.order.state,'validating');
   const replay=await req(path()+'/actions/submit',{body:{},version:4,key:submitKey});assert.deepEqual(replay.data,accepted);assert.equal(replay.replayed,'true');
   await f.owner.query('DELETE FROM party.customer_access WHERE principal_id=$1',[actors[0].principalId]);
   assert.equal((await req(path()+'/actions/submit',{body:{},version:4,key:submitKey})).status,404);
   assert.equal((await transaction(pool,actors[0],c=>c.query('SELECT * FROM orders.intake_evidence'))).rowCount,0);
   await f.owner.query('INSERT INTO party.customer_access VALUES($1,$2,$3)',[actors[0].companyId,f.customers[0],actors[0].principalId]);
   assert.equal((await f.owner.query('SELECT reason FROM orders.intake_return WHERE order_id=$1',[order.order.id])).rows[0].reason,reason.reason);
  });
  await t.test('unknown dimensions, missing point, packaging, outside, expiry and future area',async()=>{
   for(const change of [{items:[{...draft.items[0],weightKg:null,unknownReason:'DEMO pending'}]},{pickup:{...draft.pickup,point:null}},{delivery:{...draft.delivery,point:{lng:105.1,lat:11.5}}},{requestedDeliveryWindow:{start:'2020-01-01T00:00:00Z',end:'2020-01-02T00:00:00Z'},requestedPickupWindow:{start:'2019-12-30T00:00:00Z',end:'2019-12-31T00:00:00Z'}}]){
    const created=await req('/orders',{body:{...draft,...change}});assert.equal(created.status,201);const p='/orders/'+created.data.order.id;
    assert.equal((await req(p+'/intake-evidence',{body:input,version:1})).status,201);assert.equal((await req(p+'/actions/submit',{body:{},version:1})).status,422);assert.equal((await req(p)).data.order.version,1);
   }
   const created=await req('/orders',{body:draft}),p='/orders/'+created.data.order.id;
   await req(p+'/intake-evidence',{body:{...input,measurements:[{...input.measurements[0],packagingConfirmed:false}]},version:1});assert.equal((await req(p+'/actions/submit',{body:{},version:1})).status,422);
   await req('/service-areas/'+area.id+'/actions/retire',{body:reason,version:2});
   const future=(await req('/service-areas',{body:{...areaDraft,effectiveFrom:new Date(Date.now()+86400000).toISOString()}})).data;await req('/service-areas/'+future.id+'/actions/publish',{body:reason,version:1});
   await req(p+'/intake-evidence',{body:input,version:1});assert.ok((await req(p+'/intake-check')).data.blockers.every(x=>x.code==='AREA_OUTSIDE'));assert.equal((await req(p+'/actions/submit',{body:{},version:1})).status,422);
  });
  await t.test('restart preserves acceptance snapshot and idempotency result',async()=>{
   await stop();await start();assert.deepEqual((await req(path())).data,accepted);assert.deepEqual((await req(path()+'/actions/submit',{body:{},version:4,key:submitKey})).data,accepted);
  });
 }finally{await stop();await f.cleanup();}
});
