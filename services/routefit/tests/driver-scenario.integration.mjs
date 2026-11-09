import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
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

test('driver scenario creates all four real development stages',async()=>{
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
  {const token=randomBytes(32).toString('hex'),csrf=randomBytes(32).toString('hex');sessions.push({...fixture.driver,tokenHash:digest(token),csrfHash:digest(csrf),permissions:['driver:tasks:read','driver:tasks:accept','driver:tasks:reject','driver:tasks:execute','driver:locations','driver:delivery:record','driver:custody:confirm','driver:evidence:create','driver:evidence:read','driver:sync'],expiresAt:new Date(Date.now()+3600000).toISOString()});}
  await writeFile(sessionsFile,JSON.stringify(sessions),{mode:0o600});
  pool=new pg.Pool({connectionString:fixture.runtimeUrl,max:5});await assertRuntimeRole(pool);
  let auth,access;server=apiServer({pool,authenticate:Object.assign(request=>auth(request),{revoke:principal=>auth.revoke(principal)}),localAccess:(...args)=>access(...args),evidenceDirectory:dir});server.listen(0,'127.0.0.1');await once(server,'listening');const origin=`http://127.0.0.1:${server.address().port}`;auth=developmentAuth(sessions,origin);access=localBrowser({origin,root:fileURLToPath(new URL('../../../',import.meta.url)),sessionsFile,authenticate:auth,pool});
  process.env.NODE_ENV='development';process.env.ROUTEFIT_AUTH_MODE='development';
  for(const expected of [{stage:'offered',assignmentState:'offered',pendingCustody:0,ready:false},{stage:'custody-pending',assignmentState:'accepted',pendingCustody:1,ready:false},{stage:'ready-to-depart',assignmentState:'accepted',pendingCustody:0,ready:true},{stage:'delivery-ready',assignmentState:'accepted',pendingCustody:0,ready:false}]){
   const scenarioFile=join(dir,expected.stage+'.json'),actual=await createDriverScenario({stage:expected.stage,origin,databaseUrl:fixture.runtimeUrl,fixtureUrl:fixture.fixtureUrl,sessionsFile,scenarioFile});
   assert.deepEqual({stage:actual.stage,assignmentState:actual.assignmentState,pendingCustody:actual.pendingCustody,ready:actual.ready},expected);
   if(expected.stage==='delivery-ready')assert.match(actual.recipientAuthorizationId,/^[0-9a-f-]{36}$/);
   if(process.platform!=='win32')assert.equal((await stat(scenarioFile)).mode&0o777,0o600);const secret=JSON.parse(await readFile(scenarioFile,'utf8'));assert.ok(secret.token&&secret.csrfToken&&secret.deviceId&&secret.shiftId);
  }
 }finally{
  process.env.NODE_ENV=previous.NODE_ENV;process.env.ROUTEFIT_AUTH_MODE=previous.ROUTEFIT_AUTH_MODE;
  if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}await pool?.end();await fixture.cleanup();await rm(dir,{recursive:true,force:true});
 }
});
