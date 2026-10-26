import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {once} from 'node:events';
import pg from 'pg';
import {localFixture} from '../db/local-fixture.mjs';
import {apiServer} from '../application/http.mjs';
import {developmentAuth,digest,developmentPermissions} from '../adapters/development-auth.mjs';
import {validate} from '../adapters/contract.mjs';

if(!process.env.ROUTEFIT_TEST_DATABASE_URL)throw Error('ROUTEFIT_TEST_DATABASE_URL required');
test('real PostgreSQL carrier partner lifecycle',async t=>{
 const fixture=await localFixture(process.env.ROUTEFIT_TEST_DATABASE_URL),verifier={companyId:fixture.principals[0].companyId,principalId:randomUUID()};
 await fixture.owner.query("INSERT INTO org.principal(id,company_id,kind,display_name,idp_subject,status) VALUES($1,$2,'STAFF','DEMO partner verifier',$3,'ACTIVE')",[verifier.principalId,verifier.companyId,'local:'+verifier.principalId]);
 const actors=[fixture.principals[0],fixture.principals[1],verifier].map(value=>({...value,token:randomBytes(32).toString('hex'),csrf:randomBytes(32).toString('hex'),permissions:developmentPermissions}));
 let pool,server,origin;
 async function start(){
  pool=new pg.Pool({connectionString:fixture.runtimeUrl,max:5});let auth;
  server=apiServer({pool,authenticate:request=>auth(request)});server.listen(0,'127.0.0.1');await once(server,'listening');origin='http://127.0.0.1:'+server.address().port;
  auth=developmentAuth(actors.map(actor=>({...actor,tokenHash:digest(actor.token),csrfHash:digest(actor.csrf),expiresAt:new Date(Date.now()+600000).toISOString()})),origin);
 }
 async function stop(){server?.closeAllConnections();if(server)await new Promise(resolve=>server.close(resolve));await pool?.end();}
 async function req(path,{body,actor=0,version,key=randomUUID(),method=body===undefined?'GET':'POST'}={}){
  const current=actors[actor],response=await fetch(origin+'/api/ops/v1'+path,{method,headers:{Cookie:'rf_session='+current.token,Origin:origin,'X-CSRF-Token':current.csrf,'Content-Type':'application/json','Idempotency-Key':key,...(version?{'If-Match':'"'+version+'"'}:{})},...(method==='GET'?{}:{body:JSON.stringify(body)})});
  const data=await response.json(),schema=path==='/carrier-partners'&&method==='GET'?'PartnerPage':'Partner';validate(response.ok?schema:'ApiError',data);return {status:response.status,data};
 }
 try{
  await start();
  const bundleId=randomUUID(),fileId=randomUUID(),sha='b'.repeat(64);
  await fixture.owner.query("INSERT INTO evidence.file(id,company_id,principal_id,resource_type,resource_id,purpose,declared_mime_type,declared_size_bytes,declared_sha256,state,object_key,actual_mime_type,actual_size_bytes,actual_sha256,upload_token_hash,expires_at,version) VALUES($1,$2,$3,'PARTNER',$4,'QUALIFICATION','application/pdf',1,$5,'available',$6,'application/pdf',1,$5,$5,now()+interval '1 hour',3)",[fileId,actors[0].companyId,actors[0].principalId,bundleId,sha,fileId+'.pdf']);
  await t.test('create, verify, suspend, reinstate and exit preserve evidence and tenant scope',async()=>{
   const draft={name:'DEMO partner carrier',kind:'PARCEL_CARRIER',contact:'DEMO contact',phone:'+85510000000',qualificationFileIds:[fileId]},key=randomUUID();
   const pair=await Promise.all([req('/carrier-partners',{body:draft,key}),req('/carrier-partners',{body:draft,key})]);assert.deepEqual(pair.map(result=>result.status),[201,201]);assert.deepEqual(pair[0].data,pair[1].data);
   let partner=pair[0].data;assert.deepEqual([partner.state,partner.version,partner.agreementVersionId],['draft',1,null]);
   assert.equal((await req('/carrier-partners')).data.items.some(item=>item.id===partner.id),true);
   assert.equal((await req('/carrier-partners',{actor:1})).data.items.length,0);
   const action={reason:'DEMO qualification reviewed',evidenceFileIds:[fileId]};
   assert.equal((await req('/carrier-partners/'+partner.id+'/actions/verify',{body:action,version:2})).status,412);
   assert.equal((await req('/carrier-partners/'+partner.id+'/actions/verify',{body:action,version:1})).status,403);
   partner=(await req('/carrier-partners/'+partner.id+'/actions/verify',{body:action,actor:2,version:1})).data;assert.equal(partner.state,'active');assert.ok(partner.agreementVersionId);
   partner=(await req('/carrier-partners/'+partner.id+'/actions/suspend',{body:action,actor:2,version:2})).data;assert.deepEqual([partner.state,partner.version],['suspended',3]);
   partner=(await req('/carrier-partners/'+partner.id+'/actions/reinstate',{body:action,actor:2,version:3})).data;assert.deepEqual([partner.state,partner.version],['active',4]);
   const exited=await req('/carrier-partners/'+partner.id+'/actions/exit',{body:action,version:4});assert.equal(exited.status,200,JSON.stringify(exited.data));partner=exited.data;assert.deepEqual([partner.state,partner.version],['exited',5]);
   assert.equal((await req('/carrier-partners/'+partner.id+'/actions/suspend',{body:action,version:5})).status,409);
  });
  await t.test('carrier history is append-only and unavailable qualifications fail closed',async()=>{
   await assert.rejects(fixture.owner.query('DELETE FROM partner.carrier_event'),error=>error.code==='42501');
   assert.equal((await req('/carrier-partners',{body:{name:'bad',kind:'PARTNER_VEHICLE',contact:'c',phone:'p',qualificationFileIds:[randomUUID()]}})).status,422);
  });
 }finally{await stop();await fixture.cleanup();}
});
