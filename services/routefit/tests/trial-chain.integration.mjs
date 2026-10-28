import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {runTrialInit} from '../scripts/trial-init.mjs';
import {runTrialStaff} from '../scripts/trial-staff.mjs';
import {runTrialImport} from '../scripts/trial-import.mjs';
import {runBackup} from '../scripts/trial-backup.mjs';
import {runRestore} from '../scripts/trial-restore.mjs';
import {apiServer} from '../application/http.mjs';
import {localBrowser,createBrowserGrant} from '../adapters/local-browser.mjs';
import {developmentAuth} from '../adapters/development-auth.mjs';

test('trial chain runs from clean database through activation, order, backup and restore',async t=>{
 if(!process.env.ROUTEFIT_TEST_DATABASE_URL){t.skip('ROUTEFIT_TEST_DATABASE_URL is required');return;}
 const root=await mkdtemp(join(tmpdir(),'routefit-chain-')),companyFile=join(root,'trial-company.json'),envFile=join(root,'dev.env'),sessionFile=join(root,'sessions.json'),staffFile=join(root,'staff.json'),adminEnv=join(root,'admin.env'),importDir=join(root,'import'),backupDir=join(root,'backups');await mkdir(importDir);await mkdir(backupDir);
 const companyId=randomUUID(),database=`routefit_chain_${randomUUID().replaceAll('-','').slice(0,12)}`;await writeFile(companyFile,JSON.stringify({id:companyId,name:'Synthetic Chain Company'}));await writeFile(adminEnv,`ROUTEFIT_PG_ADMIN_URL=${process.env.ROUTEFIT_TEST_DATABASE_URL}\n`);await writeFile(staffFile,JSON.stringify([{humanId:'operator',sshLogin:'operator',roles:['order_quote']}])) ;await writeFile(join(importDir,'customers.csv'),'name\nSynthetic Customer\n');await writeFile(join(importDir,'service-areas.csv'),'name,type\nSynthetic Area,ALLOW\n');
 let init,server,pool,restoredDb;
 try{
  init=await runTrialInit({adminUrl:process.env.ROUTEFIT_TEST_DATABASE_URL,databaseName,envFile,companyFile});
  await runTrialStaff({env:{ROUTEFIT_TRIAL:'1',ROUTEFIT_SESSION_FILE:sessionFile,ROUTEFIT_TRIAL_STAFF_FILE:staffFile,ROUTEFIT_ADMIN_ENV_FILE:adminEnv}});
  const runtimeEnv=Object.fromEntries((await import('node:fs/promises')).readFile(envFile,'utf8').then(x=>x.split(/\n/).filter(Boolean).map(line=>line.split('='))));Object.assign(runtimeEnv,{ROUTEFIT_DATABASE_URL:runtimeEnv.ROUTEFIT_DATABASE_URL,ROUTEFIT_TRIAL:'1',ROUTEFIT_SESSION_FILE:sessionFile,ROUTEFIT_TRIAL_IMPORT_DIRECTORY:importDir});
  await runTrialImport({env:runtimeEnv});
  const sessions=JSON.parse(await (await import('node:fs/promises')).readFile(sessionFile,'utf8'));assert.equal(sessions.length,1);
  pool=new pg.Pool({connectionString:runtimeEnv.ROUTEFIT_DATABASE_URL});const customer=(await pool.query('SELECT id FROM party.customer WHERE company_id=$1',[companyId])).rows[0];assert.ok(customer);
  let auth,access;server=apiServer({pool,authenticate:req=>auth(req),localAccess:(...args)=>access(...args)});server.listen(0,'127.0.0.1');await once(server,'listening');const actualOrigin=`http://127.0.0.1:${server.address().port}`;auth=developmentAuth(sessions,actualOrigin);access=localBrowser({origin:actualOrigin,root:join(process.cwd(),'../..'),sessionsFile,trialMode:true,authenticate:auth,pool});
  const grant=await createBrowserGrant({sessionsFile,origin:actualOrigin}),activated=await fetch(grant.url,{redirect:'manual'});assert.equal(activated.status,303);assert.equal(activated.headers.get('location'),'/prototype/orders.html');
  const cookie=activated.headers.get('set-cookie').split(';')[0],sessionResponse=await fetch(actualOrigin+'/dev/session',{headers:{Cookie:cookie}}),sessionBody=await sessionResponse.json();const draft=JSON.parse(await (await import('node:fs/promises')).readFile(new URL('../../../contracts/examples/order-draft.json',import.meta.url),'utf8'));draft.customerId=customer.id;
  const response=await fetch(actualOrigin+'/api/ops/v1/orders',{method:'POST',headers:{Cookie:cookie,Origin:actualOrigin,'X-CSRF-Token':sessionBody.csrfToken,'Content-Type':'application/json','Idempotency-Key':randomUUID()},body:JSON.stringify(draft)});assert.equal(response.status,201);
  const backup=await runBackup({env:{...runtimeEnv,ROUTEFIT_BACKUP_DIRECTORY:backupDir},backupDirectory:backupDir});restoredDb=`${database}_restore`;await runRestore({file:backup.file,database:restoredDb,adminUrl:process.env.ROUTEFIT_TEST_DATABASE_URL});const admin=new pg.Pool({connectionString:process.env.ROUTEFIT_TEST_DATABASE_URL});const before=await pool.query('SELECT count(*)::int AS count FROM party.customer');const target=new URL(process.env.ROUTEFIT_TEST_DATABASE_URL);target.pathname='/'+restoredDb;const restored=new pg.Pool({connectionString:target.href});const after=await restored.query('SELECT count(*)::int AS count FROM party.customer');assert.equal(after.rows[0].count,before.rows[0].count);await restored.end();await admin.query(`DROP DATABASE IF EXISTS "${restoredDb}"`);await admin.end();
 }finally{server?.closeAllConnections();if(server)await new Promise(resolve=>server.close(resolve));await pool?.end();const admin=new pg.Pool({connectionString:process.env.ROUTEFIT_TEST_DATABASE_URL});if(restoredDb)await admin.query(`DROP DATABASE IF EXISTS "${restoredDb}"`).catch(()=>{});if(init?.databaseName)await admin.query(`DROP DATABASE IF EXISTS "${init.databaseName}"`).catch(()=>{});await admin.end().catch(()=>{});await rm(root,{recursive:true,force:true});}
});
