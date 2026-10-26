import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {readFile} from 'node:fs/promises';
import pg from 'pg';
import {localFixture} from '../db/local-fixture.mjs';
import {apiServer} from '../application/http.mjs';
import {developmentAuth,digest,developmentPermissions} from '../adapters/development-auth.mjs';
import {validate} from '../adapters/contract.mjs';

if(!process.env.ROUTEFIT_TEST_DATABASE_URL)throw Error('ROUTEFIT_TEST_DATABASE_URL required');
test('real PostgreSQL dispatch exception lifecycle',async t=>{
 const fixture=await localFixture(process.env.ROUTEFIT_TEST_DATABASE_URL),owner={companyId:fixture.principals[0].companyId,principalId:randomUUID()};
 await fixture.owner.query("INSERT INTO org.principal(id,company_id,kind,display_name,idp_subject,status) VALUES($1,$2,'STAFF','DEMO exception owner',$3,'ACTIVE')",[owner.principalId,owner.companyId,'local:'+owner.principalId]);
 await fixture.owner.query('INSERT INTO party.customer_access(company_id,customer_id,principal_id) VALUES($1,$2,$3)',[owner.companyId,fixture.customers[0],owner.principalId]);
 const actors=[fixture.principals[0],fixture.principals[1],owner].map(value=>({...value,token:randomBytes(32).toString('hex'),csrf:randomBytes(32).toString('hex'),permissions:developmentPermissions}));
 let pool,server,origin;
 async function start(){
  pool=new pg.Pool({connectionString:fixture.runtimeUrl,max:5});let auth;
  server=apiServer({pool,authenticate:request=>auth(request)});server.listen(0,'127.0.0.1');await once(server,'listening');origin='http://127.0.0.1:'+server.address().port;
  auth=developmentAuth(actors.map(actor=>({...actor,tokenHash:digest(actor.token),csrfHash:digest(actor.csrf),expiresAt:new Date(Date.now()+600000).toISOString()})),origin);
 }
 async function stop(){server?.closeAllConnections();if(server)await new Promise(resolve=>server.close(resolve));await pool?.end();}
 async function req(path,{body,actor=0,version,key=randomUUID(),method=body===undefined?'GET':'POST'}={}){
  const current=actors[actor],response=await fetch(origin+'/api/ops/v1'+path,{method,headers:{Cookie:'rf_session='+current.token,Origin:origin,'X-CSRF-Token':current.csrf,'Content-Type':'application/json','Idempotency-Key':key,...(version?{'If-Match':'"'+version+'"'}:{})},...(method==='GET'?{}:{body:JSON.stringify(body)})});
  const data=await response.json(),schema=path==='/orders'?'OrderDetail':path==='/exceptions'&&method==='GET'?'ExceptionPage':'Exception';validate(response.ok?schema:'ApiError',data);return {status:response.status,data,headers:response.headers};
 }
 try{
  await start();
  const source=JSON.parse(await readFile(new URL('../../../contracts/examples/order-draft.json',import.meta.url),'utf8'));
  const order=(await req('/orders',{body:{...source,customerId:fixture.customers[0]}})).data,packageId=order.items[0].packageIds[0];
  await t.test('create, list, assign, resolve, replay and tenant isolation',async()=>{
   const input={orderId:order.order.id,category:'ACCIDENT',description:'DEMO only: vehicle incident reported',packageIds:[packageId],evidenceFileIds:[],observedAt:new Date().toISOString()},key=randomUUID();
   const pair=await Promise.all([req('/exceptions',{body:input,key}),req('/exceptions',{body:input,key})]);assert.deepEqual(pair.map(result=>result.status),[201,201]);assert.deepEqual(pair[0].data,pair[1].data);
   let exception=pair[0].data;assert.deepEqual([exception.state,exception.version,exception.ownerId],['open',1,null]);
   const page=(await req('/exceptions')).data;assert.equal(page.items.some(item=>item.id===exception.id),true);
   assert.equal((await req('/exceptions',{actor:1})).data.items.length,0);
   assert.equal((await req('/exceptions',{body:{...input,orderId:randomUUID()},actor:1})).status,404);
   const assignment={ownerId:owner.principalId,dueAt:new Date(Date.now()+600000).toISOString(),reason:'DEMO dispatcher ownership'};
   assert.equal((await req('/exceptions/'+exception.id+'/actions/assign',{body:assignment,version:2})).status,412);
   exception=(await req('/exceptions/'+exception.id+'/actions/assign',{body:assignment,version:1})).data;assert.deepEqual([exception.state,exception.version,exception.ownerId],['assigned',2,owner.principalId]);
   const fileId=randomUUID(),sha='a'.repeat(64);
   await fixture.owner.query("INSERT INTO evidence.file(id,company_id,principal_id,resource_type,resource_id,purpose,declared_mime_type,declared_size_bytes,declared_sha256,state,object_key,actual_mime_type,actual_size_bytes,actual_sha256,upload_token_hash,expires_at,version) VALUES($1,$2,$3,'ORDER',$4,'DISPUTE','image/png',1,$5,'available',$6,'image/png',1,$5,$5,now()+interval '1 hour',3)",[fileId,actors[0].companyId,actors[0].principalId,order.order.id,sha,fileId+'.png']);
   assert.equal((await req('/exceptions/'+exception.id+'/actions/resolve',{body:{reason:'DEMO evidence reviewed',evidenceFileIds:[randomUUID()]},actor:2,version:2})).status,422);
   exception=(await req('/exceptions/'+exception.id+'/actions/resolve',{body:{reason:'DEMO evidence reviewed',evidenceFileIds:[fileId]},actor:2,version:2})).data;assert.deepEqual([exception.state,exception.version],['resolved',3]);
   assert.equal((await req('/exceptions/'+exception.id+'/actions/resolve',{body:{reason:'again',evidenceFileIds:[fileId]},actor:2,version:3})).status,409);
   const closeKey=randomUUID(),closed=await Promise.all([req('/exceptions/'+exception.id+'/actions/close',{body:{reason:'DEMO every package disposition checked',evidenceFileIds:[fileId]},version:3,key:closeKey}),req('/exceptions/'+exception.id+'/actions/close',{body:{reason:'DEMO every package disposition checked',evidenceFileIds:[fileId]},version:3,key:closeKey})]);assert.deepEqual(closed.map(result=>result.status),[200,200]);assert.deepEqual(closed.map(result=>[result.data.state,result.data.version]),[['closed',4],['closed',4]]);assert.equal((await req('/exceptions/'+exception.id+'/actions/close',{body:{reason:'again',evidenceFileIds:[fileId]},version:4})).status,409);
  });
  await t.test('history is append-only and query validation fails closed',async()=>{
   await assert.rejects(fixture.owner.query('DELETE FROM casework.dispatch_exception_event'),error=>error.code==='42501');
   assert.equal((await req('/exceptions?cursor=bad')).status,422);
  });
 }finally{await stop();await fixture.cleanup();}
});
