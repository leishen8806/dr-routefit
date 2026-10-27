import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {once} from 'node:events';
import pg from 'pg';
import {localFixture} from '../db/local-fixture.mjs';
import {apiServer} from '../application/http.mjs';
import {developmentAuth,digest,developmentPermissions} from '../adapters/development-auth.mjs';
import {transaction} from '../adapters/postgres.mjs';
import {validate} from '../adapters/contract.mjs';

if(!process.env.ROUTEFIT_TEST_DATABASE_URL)throw Error('ROUTEFIT_TEST_DATABASE_URL is required');
test('real PostgreSQL policy approval HTTP lifecycle',async t=>{
 const f=await localFixture(process.env.ROUTEFIT_TEST_DATABASE_URL),people=[f.principals[0]];
 for(const name of ['reviewer','approver']){const actor={companyId:people[0].companyId,principalId:randomUUID()};await f.owner.query("INSERT INTO org.principal(id,company_id,kind,display_name,idp_subject,status) VALUES($1,$2,'STAFF',$3,$4,'ACTIVE')",[actor.principalId,actor.companyId,'DEMO '+name,'local:'+actor.principalId]);people.push(actor);}
 people.push(f.principals[1],{...people[0],readonly:true});
 const actors=people.map(a=>({...a,token:randomBytes(32).toString('hex'),csrf:randomBytes(32).toString('hex')}));
 let pool,server,origin;
 async function start(){pool=new pg.Pool({connectionString:f.runtimeUrl,max:5});let auth;server=apiServer({pool,authenticate:r=>auth(r)});server.listen(0,'127.0.0.1');await once(server,'listening');origin=`http://127.0.0.1:${server.address().port}`;auth=developmentAuth(actors.map(a=>({...a,tokenHash:digest(a.token),csrfHash:digest(a.csrf),permissions:a.readonly?['pricing:read']:developmentPermissions,expiresAt:new Date(Date.now()+600000).toISOString()})),origin);}
 async function stop(){server?.closeAllConnections();if(server)await new Promise(r=>server.close(r));await pool?.end();server=null;pool=null;}
 async function req(path,{body,version,key=randomUUID(),actor=0,headers={}}={}){
  const a=actors[actor],r=await fetch(origin+'/api/ops/v1/pricing'+path,{method:body?'POST':'GET',headers:{Cookie:'rf_session='+a.token,Origin:origin,'X-CSRF-Token':a.csrf,'Content-Type':'application/json','Idempotency-Key':key,...(version?{'If-Match':`"${version}"`}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
  const data=await r.json();validate(r.ok?(path==='/policy-versions'||path.startsWith('/policy-versions?')?'PricingPolicyVersionPage':path.includes('policy-versions')?'PricingPolicyVersion':'PricingTariff'):'ApiError',data);return {status:r.status,data,headers:r.headers};
 }
 const base={code:'base',enabled:true,method:'fixed',amount:200,unit:null,includedMilli:0,stepMilli:1000,share:true,scope:'DEMO',evidence:'DEMO fixed fee'};
 const window=()=>({validFrom:new Date(Date.now()-1000).toISOString(),validUntil:new Date(Date.now()+600000).toISOString(),quoteValiditySeconds:120,serviceLevels:['S2'],reason:'DEMO proposed fee, not production'});
 const decision={reason:'DEMO independently checked exact frozen version'};let tariff,policy,published,submitKey=randomUUID(),submitBody=window();
 try{
  await start();
  tariff=(await req('/tariffs',{body:{name:'DEMO policy',owner:'DR',currency:'USD',scope:'DEMO fixed delivery'}})).data;
  tariff=(await req(`/tariffs/${tariff.id}/actions/save-fee`,{body:base,version:tariff.version})).data;
  tariff=(await req(`/tariffs/${tariff.id}/actions/save-fee`,{body:{...base,code:'insurance',amount:75,share:false},version:tariff.version})).data;
  await t.test('submit freezes source, scopes permissions, retries and rejects spoofing',async()=>{
   const path=`/tariffs/${tariff.id}/policy-versions`;
   assert.equal((await req(path,{body:submitBody,version:tariff.version,actor:4})).status,403);
   assert.equal((await req(path,{body:submitBody,version:1})).status,412);
   assert.equal((await req(path,{body:{...submitBody,preparedBy:actors[1].principalId},version:tariff.version})).status,422);
   const pair=await Promise.all([req(path,{body:submitBody,version:tariff.version,key:submitKey}),req(path,{body:submitBody,version:tariff.version,key:submitKey})]);
   assert.deepEqual(pair.map(r=>r.status),[201,201]);assert.deepEqual(pair[0].data,pair[1].data);policy=pair[0].data;assert.deepEqual(policy.tariff,tariff);
   assert.equal((await req(path,{body:{...submitBody,reason:'changed'},version:tariff.version,key:submitKey})).status,409);
   assert.equal((await req('/policy-versions/'+policy.id,{actor:3})).status,404);
   assert.equal((await transaction(pool,actors[3],c=>c.query('SELECT * FROM pricing.policy_version'))).rowCount,0);
  });
  await t.test('service enforces distinct preparer reviewer approver and required review',async()=>{
   const path='/policy-versions/'+policy.id;
   assert.equal((await req(path+'/actions/publish',{body:decision,version:1,actor:2})).status,409);
   assert.equal((await req(path+'/actions/review',{body:decision,version:1})).status,403);
   assert.equal((await req(path+'/actions/review',{body:decision,version:1,actor:4})).status,403);
   const key=randomUUID(),review=await req(path+'/actions/review',{body:decision,version:1,actor:1,key});assert.equal(review.status,200);assert.equal(review.data.version,2);
   assert.deepEqual((await req(path+'/actions/review',{body:decision,version:1,actor:1,key})).data,review.data);
   for(const actor of [0,1])assert.equal((await req(path+'/actions/publish',{body:decision,version:2,actor})).status,403);
   published=await req(path+'/actions/publish',{body:decision,version:2,actor:2});assert.equal(published.status,200);assert.equal(published.data.state,'PUBLISHED');assert.equal(published.data.version,3);
   assert.equal(published.data.tariff.rules.find(r=>r.code==='insurance').share,false);
   assert.equal((await req(path+'/actions/publish',{body:decision,version:2,actor:2})).status,412);
   const list=await req('/policy-versions?state=PUBLISHED&serviceLevel=S2&effectiveAt='+encodeURIComponent(new Date().toISOString()),{actor:0});
   assert.equal(list.status,200,JSON.stringify(list.data));assert.equal(list.data.items.length,1);assert.equal(list.data.items[0].id,policy.id);assert.equal(list.data.items[0].state,'PUBLISHED');
   const afterExpiry=await req('/policy-versions?effectiveAt='+encodeURIComponent(new Date(Date.now()+86400000).toISOString()),{actor:0});assert.equal(afterExpiry.status,200);assert.equal(afterExpiry.data.items.length,0);
   assert.equal((await req('/policy-versions?state=SUBMITTED',{actor:0})).status,422);
   assert.equal((await req('/policy-versions?tariffId='+tariff.id,{actor:4})).status,200);
   const otherCompany=await req('/policy-versions?tariffId='+tariff.id,{actor:3});assert.equal(otherCompany.status,200);assert.equal(otherCompany.data.items.length,0);
  });
  await t.test('published source remains immutable after later draft edits and restart',async()=>{
   tariff=(await req(`/tariffs/${tariff.id}/actions/save-fee`,{body:{...base,amount:999},version:tariff.version})).data;
   const view=await req('/policy-versions/'+policy.id);assert.deepEqual(view.data,published.data);assert.equal(view.data.tariff.rules.find(r=>r.code==='base').amount,200);
   await stop();await start();assert.deepEqual((await req('/policy-versions/'+policy.id)).data,published.data);
   const replay=await req(`/tariffs/${tariff.id}/policy-versions`,{body:submitBody,version:policy.tariffVersion,key:submitKey});assert.deepEqual(replay.data,policy);assert.equal(replay.headers.get('Idempotency-Replayed'),'true');
  });
  await t.test('source change after review invalidates publication; fresh submission is required',async()=>{
   const p=(await req(`/tariffs/${tariff.id}/policy-versions`,{body:window(),version:tariff.version})).data;
   assert.equal((await req(`/policy-versions/${p.id}/actions/review`,{body:decision,version:1,actor:1})).status,200);
   tariff=(await req(`/tariffs/${tariff.id}/actions/save-fee`,{body:{...base,amount:1000},version:tariff.version})).data;
   const result=await req(`/policy-versions/${p.id}/actions/publish`,{body:decision,version:2,actor:2});assert.equal(result.status,409);assert.equal(result.data.error.code,'SOURCE_VERSION_CHANGED');
  });
  await t.test('concurrent distinct reviews serialize and old contributors cannot self-review',async()=>{
   const p=(await req(`/tariffs/${tariff.id}/policy-versions`,{body:window(),version:tariff.version})).data;
   const pair=await Promise.all([1,2].map(actor=>req(`/policy-versions/${p.id}/actions/review`,{body:decision,version:1,actor})));assert.deepEqual(pair.map(r=>r.status).sort(),[200,412]);
   const otherPrepared=(await req(`/tariffs/${tariff.id}/policy-versions`,{body:window(),version:tariff.version,actor:1})).data;
   assert.equal((await req(`/policy-versions/${otherPrepared.id}/actions/review`,{body:decision,version:1,actor:0})).status,403);
  });
  await t.test('database constraints independently forbid self approval missing review and history overwrite',async()=>{
   const p=(await req(`/tariffs/${tariff.id}/policy-versions`,{body:window(),version:tariff.version,actor:1})).data;
   await assert.rejects(f.owner.query('INSERT INTO pricing.policy_review(company_id,policy_id,prepared_by,reviewed_by,reason) VALUES($1,$2,$3,$4,$5)',[actors[0].companyId,p.id,actors[1].principalId,actors[0].principalId,'bypass contributor check']),{code:'23514'});
   await assert.rejects(f.owner.query('INSERT INTO pricing.policy_publication(company_id,policy_id,prepared_by,reviewed_by,approved_by,reason) VALUES($1,$2,$3,$4,$5,$6)',[actors[0].companyId,p.id,actors[1].principalId,actors[0].principalId,actors[2].principalId,'missing review']),{code:'23503'});
   for(const table of ['policy_version','policy_review','policy_publication'])await assert.rejects(f.owner.query(`DELETE FROM pricing.${table}`),{code:'42501'});
   await assert.rejects(f.owner.query('UPDATE pricing.policy_version SET snapshot=$1 WHERE id=$2',[{},p.id]),{code:'42501'});
  });
  await t.test('unsupported rules and expired policies are blocked rather than silently priced as zero',async()=>{
   const p=(await req(`/tariffs/${tariff.id}/policy-versions`,{body:{...window(),validUntil:new Date(Date.now()+300).toISOString()},version:tariff.version})).data;
   await new Promise(r=>setTimeout(r,350));const expired=await req(`/policy-versions/${p.id}/actions/review`,{body:decision,version:1,actor:1});assert.equal(expired.data.error.code,'INVALID_POLICY_WINDOW');
   tariff=(await req(`/tariffs/${tariff.id}/actions/save-fee`,{body:{...base,code:'distance',method:'unit',unit:'km'},version:tariff.version})).data;
   const unsupported=await req(`/tariffs/${tariff.id}/policy-versions`,{body:window(),version:tariff.version});assert.equal(unsupported.status,422);assert.equal(unsupported.data.error.code,'CAPABILITY_DISABLED');
  });
 }finally{await stop();await f.cleanup();}
});
