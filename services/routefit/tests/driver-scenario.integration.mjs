import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {mkdtemp,readFile,rm,stat,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import pg from 'pg';
import {localFixture} from '../db/local-fixture.mjs';
import {apiServer} from '../application/http.mjs';
import {developmentAuth,developmentPermissions,digest} from '../adapters/development-auth.mjs';
import {assertRuntimeRole} from '../adapters/postgres.mjs';
import {createBrowserGrant,localBrowser} from '../adapters/local-browser.mjs';
import {buildDevelopmentPermissionSets} from '../db/dev-bootstrap-permissions.mjs';
import {createDriverScenario} from '../scripts/driver-scenario.mjs';

if(!process.env.ROUTEFIT_TEST_DATABASE_URL)throw Error('ROUTEFIT_TEST_DATABASE_URL must point to a local disposable PostgreSQL cluster administrator');

async function driverRequest(origin,session,path,body){
 const response=await fetch(origin+path,{method:'POST',headers:{Cookie:`rf_session=${session.token}`,Origin:origin,'X-CSRF-Token':session.csrfToken,'Content-Type':'application/json','Idempotency-Key':randomUUID()},body:JSON.stringify(body)}),data=await response.json();
 assert.equal(response.status,200,`${path} failed with ${response.status}`);return data;
}

async function syncFixture(fixture,scenario){
 const assignment=(await fixture.owner.query('SELECT a.version,pv.plan_version FROM dispatch.assignment a JOIN dispatch.route_plan_version pv ON pv.company_id=a.company_id AND pv.id=a.plan_version_id WHERE a.id=$1',[scenario.assignmentId])).rows[0];
 const transfer=(await fixture.owner.query("SELECT id,version FROM custody.transfer WHERE assignment_id=$1 AND state='partially_signed'",[scenario.assignmentId])).rows[0];
 assert.ok(assignment&&transfer,'custody-pending scenario must expose an assignment and pending transfer');return {assignment,transfer};
}

function handoverEvent({scenario,assignment,transfer,eventId=randomUUID(),sequence,transferVersion=Number(transfer.version)}){
 return {eventId,sequence,assignmentId:scenario.assignmentId,assignmentVersion:Number(assignment.version),planVersion:Number(assignment.plan_version),observedAt:new Date().toISOString(),type:'HANDOVER_SIGNED',payload:{transferId:transfer.id,transferVersion,evidenceFileIds:[scenario.evidenceFileId]}};
}

function quoteIdentifier(value){return '"'+String(value).replaceAll('"','""')+'"';}

async function runRepairAsTableOwner(fixture,repairSql){
 const owner=(await fixture.owner.query('SELECT current_user')).rows[0].current_user;
 let migrationPool,ownersChanged=false;
 try{
  for(const table of ['org.company','mobile.sync_event','mobile.sync_device_state'])await fixture.owner.query(`ALTER TABLE ${table} OWNER TO ${quoteIdentifier(fixture.role)}`);
  ownersChanged=true;
  migrationPool=new pg.Pool({connectionString:fixture.runtimeUrl,max:1});
  assert.deepEqual((await migrationPool.query("SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user")).rows[0],{rolsuper:false,rolbypassrls:false});
  await migrationPool.query(repairSql);
  assert.equal((await migrationPool.query("SELECT relforcerowsecurity FROM pg_class WHERE oid='org.company'::regclass")).rows[0].relforcerowsecurity,true);
 }finally{
  await migrationPool?.end();
  if(ownersChanged)for(const table of ['org.company','mobile.sync_event','mobile.sync_device_state'])await fixture.owner.query(`ALTER TABLE ${table} OWNER TO ${quoteIdentifier(owner)}`);
 }
}

test('driver scenario creates all three real development stages',async()=>{
 const fixture=await localFixture(process.env.ROUTEFIT_TEST_DATABASE_URL),dir=await mkdtemp(join(tmpdir(),'routefit-driver-scenario-')),sessionsFile=join(dir,'sessions.json');
 let pool,server;
 const previous={NODE_ENV:process.env.NODE_ENV,ROUTEFIT_AUTH_MODE:process.env.ROUTEFIT_AUTH_MODE};
 try{
  const basePermissions=developmentPermissions.filter(permission=>!['pricing:review','pricing:publish','prepayment:verify','prepayment:review','prepayment:approve','prepayment:post'].includes(permission)),permissionSets=buildDevelopmentPermissionSets(basePermissions);
  for(const label of ['Pricing review','Pricing publish','Finance review','Finance approve','Order quote','Case decider']){
   const principalId=randomUUID(),companyId=fixture.principals[0].companyId;
   await fixture.owner.query("INSERT INTO org.principal(id,company_id,kind,display_name,idp_subject,status) VALUES($1,$2,'STAFF',$3,$4,'ACTIVE')",[principalId,companyId,'DEMO '+label,'local:'+principalId]);
   if(label.startsWith('Finance')||label==='Order quote'||label==='Case decider')await fixture.owner.query('INSERT INTO party.customer_access VALUES($1,$2,$3)',[companyId,fixture.customers[0],principalId]);
   fixture.principals.push({companyId,principalId});
  }
  const sessions=fixture.principals.map((principal,index)=>{const token=randomBytes(32).toString('hex'),csrf=randomBytes(32).toString('hex');return {...principal,tokenHash:digest(token),csrfHash:digest(csrf),permissions:permissionSets[index],expiresAt:new Date(Date.now()+3600000).toISOString()};});
  {const token=randomBytes(32).toString('hex'),csrf=randomBytes(32).toString('hex');sessions.push({...fixture.driver,tokenHash:digest(token),csrfHash:digest(csrf),permissions:['driver:tasks:read','driver:tasks:accept','driver:tasks:reject','driver:tasks:execute','driver:locations','driver:delivery:record','driver:custody:confirm','driver:sync'],expiresAt:new Date(Date.now()+3600000).toISOString()});}
  await writeFile(sessionsFile,JSON.stringify(sessions),{mode:0o600});
  pool=new pg.Pool({connectionString:fixture.runtimeUrl,max:5});await assertRuntimeRole(pool);
  let auth,access;server=apiServer({pool,authenticate:Object.assign(request=>auth(request),{revoke:principal=>auth.revoke(principal)}),localAccess:(...args)=>access(...args),evidenceDirectory:dir,requestRateLimit:1000});server.listen(0,'127.0.0.1');await once(server,'listening');const origin=`http://127.0.0.1:${server.address().port}`;auth=developmentAuth(sessions,origin);access=localBrowser({origin,root:fileURLToPath(new URL('../../../',import.meta.url)),sessionsFile,authenticate:auth,pool});
  process.env.NODE_ENV='development';process.env.ROUTEFIT_AUTH_MODE='development';
  for(const expected of [{stage:'offered',assignmentState:'offered',pendingCustody:0,ready:false},{stage:'custody-pending',assignmentState:'accepted',pendingCustody:1,ready:false},{stage:'ready-to-depart',assignmentState:'accepted',pendingCustody:0,ready:true}]){
   const scenarioFile=join(dir,expected.stage+'.json'),actual=await createDriverScenario({stage:expected.stage,origin,databaseUrl:fixture.runtimeUrl,fixtureUrl:fixture.fixtureUrl,sessionsFile,scenarioFile});
   assert.deepEqual({stage:actual.stage,assignmentState:actual.assignmentState,pendingCustody:actual.pendingCustody,ready:actual.ready},expected);
   if(process.platform!=='win32')assert.equal((await stat(scenarioFile)).mode&0o777,0o600);const secret=JSON.parse(await readFile(scenarioFile,'utf8'));assert.ok(secret.token&&secret.csrfToken&&secret.deviceId&&secret.shiftId);
  }

  const rejectedFile=join(dir,'sync-rejected.json'),rejectedScenario=await createDriverScenario({stage:'custody-pending',origin,databaseUrl:fixture.runtimeUrl,fixtureUrl:fixture.fixtureUrl,sessionsFile,scenarioFile:rejectedFile}),rejectedSession=JSON.parse(await readFile(rejectedFile,'utf8')),rejectedFixture=await syncFixture(fixture,rejectedScenario);
  const first=handoverEvent({...rejectedFixture,scenario:rejectedScenario,sequence:1,transferVersion:Number(rejectedFixture.transfer.version)+1}),second=handoverEvent({...rejectedFixture,scenario:rejectedScenario,sequence:2});
  const firstResult=await driverRequest(origin,rejectedSession,'/api/driver/v1/sync/events',{deviceId:rejectedScenario.deviceId,events:[first]});
  assert.deepEqual(firstResult.results.map(({result,errorCode})=>[result,errorCode]),[['REJECTED','SYNC_TRANSFER_VERSION_STALE']]);
  const afterRejection=await fixture.owner.query('SELECT (SELECT count(*)::integer FROM mobile.sync_event WHERE device_id=$1) AS events,(SELECT last_sequence::integer FROM mobile.sync_device_state WHERE device_id=$1) AS last_sequence',[rejectedScenario.deviceId]);
  assert.deepEqual(afterRejection.rows[0],{events:1,last_sequence:1},'a sequence-correct rejection must be stored and advance the device sequence');
  const secondResult=await driverRequest(origin,rejectedSession,'/api/driver/v1/sync/events',{deviceId:rejectedScenario.deviceId,events:[second]});
  assert.equal(secondResult.results[0].result,'APPLIED');
  const duplicate=await driverRequest(origin,rejectedSession,'/api/driver/v1/sync/events',{deviceId:rejectedScenario.deviceId,events:[first]});
  assert.equal(duplicate.results[0].result,'DUPLICATE');

  const batchFile=join(dir,'sync-batch.json'),batchScenario=await createDriverScenario({stage:'custody-pending',origin,databaseUrl:fixture.runtimeUrl,fixtureUrl:fixture.fixtureUrl,sessionsFile,scenarioFile:batchFile}),batchSession=JSON.parse(await readFile(batchFile,'utf8')),batchFixture=await syncFixture(fixture,batchScenario);
  const batch=await driverRequest(origin,batchSession,'/api/driver/v1/sync/events',{deviceId:batchScenario.deviceId,events:[handoverEvent({...batchFixture,scenario:batchScenario,sequence:3,transferVersion:Number(batchFixture.transfer.version)+1}),handoverEvent({...batchFixture,scenario:batchScenario,sequence:4})]});
  assert.deepEqual(batch.results.map(({result,errorCode})=>[result,errorCode]),[['REJECTED','SYNC_TRANSFER_VERSION_STALE'],['APPLIED',null]]);
  const repairInput={eventId:randomUUID(),sequence:5,assignmentId:batchScenario.assignmentId,assignmentVersion:Number(batchFixture.assignment.version),planVersion:Number(batchFixture.assignment.plan_version),observedAt:new Date().toISOString(),type:'DEPARTED',payload:{evidenceFileIds:[]}},repairResult={eventId:repairInput.eventId,result:'NEEDS_REVIEW',resourceId:batchScenario.assignmentId,resourceVersion:Number(batchFixture.assignment.version),errorCode:'SYNC_DEPARTURE_EVIDENCE_REQUIRED'},eventsBefore=Number((await fixture.owner.query('SELECT count(*) FROM mobile.sync_event WHERE device_id=$1',[batchScenario.deviceId])).rows[0].count);
  await fixture.owner.query('INSERT INTO mobile.sync_event(company_id,event_id,device_id,driver_id,sequence,assignment_id,event_type,observed_at,fingerprint,result,resource_id,resource_version,error_code,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',[fixture.driver.companyId,repairInput.eventId,batchScenario.deviceId,fixture.driver.principalId,repairInput.sequence,repairInput.assignmentId,repairInput.type,repairInput.observedAt,createHash('sha256').update(JSON.stringify(repairInput)).digest('hex'),repairResult.result,repairResult.resourceId,repairResult.resourceVersion,repairResult.errorCode,{input:repairInput,result:repairResult}]);
  const repairSql=await readFile(new URL('../db/migrations/064_repair_driver_sync_device_state.sql',import.meta.url),'utf8');
  await fixture.owner.query(repairSql);assert.equal(Number((await fixture.owner.query('SELECT last_sequence FROM mobile.sync_device_state WHERE device_id=$1',[batchScenario.deviceId])).rows[0].last_sequence),5);assert.equal(Number((await fixture.owner.query('SELECT count(*) FROM mobile.sync_event WHERE device_id=$1',[batchScenario.deviceId])).rows[0].count),eventsBefore+1);
  await fixture.owner.query(repairSql);assert.equal(Number((await fixture.owner.query('SELECT last_sequence FROM mobile.sync_device_state WHERE device_id=$1',[batchScenario.deviceId])).rows[0].last_sequence),5,'repair migration must be idempotent');
  const ownerRepairInput={...repairInput,eventId:randomUUID(),sequence:6},ownerRepairResult={...repairResult,eventId:ownerRepairInput.eventId};
  await fixture.owner.query('INSERT INTO mobile.sync_event(company_id,event_id,device_id,driver_id,sequence,assignment_id,event_type,observed_at,fingerprint,result,resource_id,resource_version,error_code,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',[fixture.driver.companyId,ownerRepairInput.eventId,batchScenario.deviceId,fixture.driver.principalId,ownerRepairInput.sequence,ownerRepairInput.assignmentId,ownerRepairInput.type,ownerRepairInput.observedAt,createHash('sha256').update(JSON.stringify(ownerRepairInput)).digest('hex'),ownerRepairResult.result,ownerRepairResult.resourceId,ownerRepairResult.resourceVersion,ownerRepairResult.errorCode,{input:ownerRepairInput,result:ownerRepairResult}]);
  await runRepairAsTableOwner(fixture,repairSql);
  assert.equal(Number((await fixture.owner.query('SELECT last_sequence FROM mobile.sync_device_state WHERE device_id=$1',[batchScenario.deviceId])).rows[0].last_sequence),6,'NOSUPERUSER NOBYPASSRLS table owner must repair lagging device state');
  assert.equal(Number((await fixture.owner.query('SELECT count(*) FROM mobile.sync_event WHERE device_id=$1',[batchScenario.deviceId])).rows[0].count),eventsBefore+2,'repair must not rewrite sync events');
 }finally{
  process.env.NODE_ENV=previous.NODE_ENV;process.env.ROUTEFIT_AUTH_MODE=previous.ROUTEFIT_AUTH_MODE;
  if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}await pool?.end();await fixture.cleanup();await rm(dir,{recursive:true,force:true});
 }
});
