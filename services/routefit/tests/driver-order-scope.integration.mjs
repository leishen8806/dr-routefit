import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import pg from 'pg';
import {localFixture} from '../db/local-fixture.mjs';
import {apiServer} from '../application/http.mjs';
import {developmentAuth,developmentPermissions,digest} from '../adapters/development-auth.mjs';
import {localBrowser} from '../adapters/local-browser.mjs';
import {buildDevelopmentPermissionSets,developmentDriverPermissions} from '../db/dev-bootstrap-permissions.mjs';
import {createDriverScenario} from '../scripts/driver-scenario.mjs';

if(!process.env.ROUTEFIT_TEST_DATABASE_URL)throw Error('ROUTEFIT_TEST_DATABASE_URL is required');

async function scenarioFixture(fixture){
 const dir=await mkdtemp(join(tmpdir(),'routefit-driver-order-scope-'));
 const basePermissions=developmentPermissions.filter(permission=>!['pricing:review','pricing:publish','prepayment:verify','prepayment:review','prepayment:approve','prepayment:post'].includes(permission));
 const permissionSets=buildDevelopmentPermissionSets(basePermissions);
 for(const label of ['Pricing review','Pricing publish','Finance review','Finance approve','Order quote','Case decider']){
  const principalId=randomUUID(),companyId=fixture.principals[0].companyId;
  await fixture.owner.query("INSERT INTO org.principal(id,company_id,kind,display_name,idp_subject,status) VALUES($1,$2,'STAFF',$3,$4,'ACTIVE')",[principalId,companyId,'DEMO '+label,'local:'+principalId]);
  if(label.startsWith('Finance')||label==='Order quote'||label==='Case decider')await fixture.owner.query('INSERT INTO party.customer_access VALUES($1,$2,$3)',[companyId,fixture.customers[0],principalId]);
  fixture.principals.push({companyId,principalId});
 }
 const sessions=fixture.principals.map((principal,index)=>{const token=randomBytes(32).toString('hex'),csrf=randomBytes(32).toString('hex');return {...principal,tokenHash:digest(token),csrfHash:digest(csrf),permissions:permissionSets[index],expiresAt:new Date(Date.now()+3600000).toISOString()};});
 {const token=randomBytes(32).toString('hex'),csrf=randomBytes(32).toString('hex');sessions.push({...fixture.driver,tokenHash:digest(token),csrfHash:digest(csrf),permissions:[...developmentDriverPermissions],expiresAt:new Date(Date.now()+3600000).toISOString()});}
 const sessionsFile=join(dir,'sessions.json');await writeFile(sessionsFile,JSON.stringify(sessions),{mode:0o600});
 const pool=new pg.Pool({connectionString:fixture.runtimeUrl,max:5});let auth,access;
 const server=apiServer({pool,authenticate:request=>auth(request),localAccess:(...args)=>access(...args),evidenceDirectory:dir,requestRateLimit:1000});
 server.listen(0,'127.0.0.1');await once(server,'listening');const origin=`http://127.0.0.1:${server.address().port}`;
 auth=developmentAuth(sessions,origin);access=localBrowser({origin,root:fileURLToPath(new URL('../../../',import.meta.url)),sessionsFile,authenticate:auth,pool});
 const previous={NODE_ENV:process.env.NODE_ENV,ROUTEFIT_AUTH_MODE:process.env.ROUTEFIT_AUTH_MODE};process.env.NODE_ENV='development';process.env.ROUTEFIT_AUTH_MODE='development';
 try{
  const scenario=await createDriverScenario({stage:'offered',origin,databaseUrl:fixture.runtimeUrl,fixtureUrl:fixture.fixtureUrl,sessionsFile,scenarioFile:join(dir,'scenario.json')});
  return {scenario,async cleanup(){process.env.NODE_ENV=previous.NODE_ENV;process.env.ROUTEFIT_AUTH_MODE=previous.ROUTEFIT_AUTH_MODE;server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await pool.end();await rm(dir,{recursive:true,force:true});}};
 }catch(error){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await pool.end();await rm(dir,{recursive:true,force:true});throw error;}
}

test('driver order RLS keeps only actually assigned drivers visible',async t=>{
 const fixture=await localFixture(process.env.ROUTEFIT_TEST_DATABASE_URL);let runtime,scenario;
 try{
  scenario=await scenarioFixture(fixture);runtime=new pg.Pool({connectionString:fixture.runtimeUrl,max:1});
  const otherDriverId=randomUUID(),otherPersonId=randomUUID(),companyId=fixture.driver.companyId;
  await fixture.owner.query("INSERT INTO org.principal(id,company_id,kind,display_name,idp_subject,status,person_id) VALUES($1,$2,'DRIVER','DEMO Other Driver',$3,'ACTIVE',$4)",[otherDriverId,companyId,'local:'+otherDriverId,otherPersonId]);
  const asDriver=async(principalId,work)=>{const client=await runtime.connect();try{await client.query('BEGIN');await client.query("SELECT set_config('app.company_id',$1,true)",[companyId]);await client.query("SELECT set_config('app.principal_id',$1,true)",[principalId??'']);const result=await work(client);await client.query('COMMIT');return result;}catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}finally{client.release();}};
  const rowsFor=principalId=>asDriver(principalId,client=>client.query('SELECT id FROM orders.draft WHERE company_id=$1 AND id=$2',[companyId,scenario.scenario.orderId]));
  const setState=state=>fixture.owner.query("UPDATE dispatch.assignment SET state=$3,version=version+1,snapshot=jsonb_set(jsonb_set(snapshot,'{state}',to_jsonb($3::text)),'{version}',to_jsonb((version+1)::bigint)),updated_at=clock_timestamp() WHERE company_id=$1 AND id=$2",[companyId,scenario.scenario.assignmentId,state]);
  for(const state of ['offered','accepted','completed'])await t.test(`AC-3 driver assigned in ${state} reads the order`,async()=>{await setState(state);assert.equal((await rowsFor(fixture.driver.principalId)).rowCount,1);});
  for(const state of ['rejected','expired','revoked','superseded'])await t.test(`AC-3 driver assigned in ${state} cannot read the order`,async()=>{await setState(state);assert.equal((await rowsFor(fixture.driver.principalId)).rowCount,0);});
  await t.test('AC-4 another driver without an assignment cannot read the order',async()=>{await setState('completed');assert.equal((await rowsFor(otherDriverId)).rowCount,0);});
  await t.test('AC-5 an accepted driver can update the order',async()=>{await setState('accepted');assert.equal((await asDriver(fixture.driver.principalId,client=>client.query('UPDATE orders.draft SET updated_at=clock_timestamp() WHERE company_id=$1 AND id=$2',[companyId,scenario.scenario.orderId]))).rowCount,1);});
  await t.test('AC-5 a completed driver cannot update the order',async()=>{await setState('completed');await assert.rejects(asDriver(fixture.driver.principalId,client=>client.query('UPDATE orders.draft SET updated_at=clock_timestamp() WHERE company_id=$1 AND id=$2',[companyId,scenario.scenario.orderId])),error=>error.code==='42501');});
  await t.test('AC-6 removing the driver identity predicate exposes the order, and restoring it hides it',async()=>{
   const policy=await (await import('node:fs/promises')).readFile(new URL('../db/migrations/070_orders_draft_driver_assignment_visibility.sql',import.meta.url),'utf8');
   const identity=" AND a.driver_id=NULLIF(current_setting('app.principal_id',true),'')::uuid";
   const mutated=policy.replace(identity,'');assert.notEqual(mutated,policy,'mutation must remove the driver identity predicate');
   try{await fixture.owner.query(mutated);assert.equal((await rowsFor(otherDriverId)).rowCount,1,'mutated policy must expose the order to the unassigned driver');}
   finally{await fixture.owner.query(policy);}
   assert.equal((await rowsFor(otherDriverId)).rowCount,0,'restored policy must hide the order from the unassigned driver');
  });
  await t.test('AC-7 an unset app.principal_id cannot read the order',async()=>{await setState('completed');assert.equal((await rowsFor(null)).rowCount,0);});
  await t.test('AC-8 adding revoked back to the policy exposes the order, and restoring it hides the order',async()=>{
   await setState('revoked');
   const policy=await (await import('node:fs/promises')).readFile(new URL('../db/migrations/070_orders_draft_driver_assignment_visibility.sql',import.meta.url),'utf8');
   const allowed="a.state IN ('offered','accepted','completed')",mutated=policy.replace(allowed,"a.state IN ('offered','accepted','completed','revoked')");assert.notEqual(mutated,policy,'mutation must add revoked to the allowed states');
   try{await fixture.owner.query(mutated);assert.equal((await rowsFor(fixture.driver.principalId)).rowCount,1,'adding revoked must expose the order to its former driver');}
   finally{await fixture.owner.query(policy);}
   assert.equal((await rowsFor(fixture.driver.principalId)).rowCount,0,'restored policy must hide the revoked assignment from its former driver');
  });
 }finally{await runtime?.end();await scenario?.cleanup();await fixture.cleanup();}
});
