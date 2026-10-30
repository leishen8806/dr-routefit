import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {rolePermissions,newSession,parseCsv,rowsToObjects,validateStaffAssignments,assertBackupDirectoryOutsideRepo,assertRestoreDatabase,renewSessions,assertTrialBackupFileMetadata,requireExistingBackupDirectory,trialBackupChecksumName,trialBackupCleanupNames,trialBackupFileMode,trialBackupName,trialBackupUmask,trialDatabaseName} from '../scripts/trial-common.mjs';
import {resolveStaffActor,parseEnvironment} from '../scripts/trial-ssh-link.mjs';
import {pgCliConnection,verifyBackupChecksum} from '../scripts/trial-db-cli.mjs';
import {runBackup} from '../scripts/trial-backup.mjs';
import {runRestore} from '../scripts/trial-restore.mjs';
import {buildTrialEnv,configureBackupRole} from '../scripts/trial-init.mjs';
import {runTrialStaff} from '../scripts/trial-staff.mjs';

test('trial staff role permissions are least privilege and distinct',()=>{
 assert.ok(rolePermissions.order_quote.includes('quotes:create'));
 assert.ok(!rolePermissions.policy_reviewer.includes('pricing:write'));
 assert.ok(!rolePermissions.policy_publisher.includes('pricing:review'));
});
test('trial tooling defaults all database targets to routefit_trial',()=>{
 assert.equal(trialDatabaseName({}),'routefit_trial');
 assert.equal(trialDatabaseName({ROUTEFIT_TRIAL_DATABASE:'routefit_custom'}),'routefit_custom');
});
test('trial:init writes the non-secret server paths needed by later scripts',()=>{
 const env=buildTrialEnv({databaseUrl:'postgresql://runtime@127.0.0.1/routefit_trial',sessionFile:'/srv/session.json',source:{ROUTEFIT_TRIAL_DATABASE:'routefit_trial',ROUTEFIT_ADMIN_ENV_FILE:'/root/admin.env',ROUTEFIT_TRIAL_STAFF_FILE:'/root/staff.json',ROUTEFIT_TRIAL_COMPANY_FILE:'/root/company.json',ROUTEFIT_TRIAL_IMPORT_DIRECTORY:'/root/import',ROUTEFIT_TRIAL_SERVICE_AREAS_FILE:'/root/areas.geojson',ROUTEFIT_TRIAL_AREA_REASON:'synthetic',ROUTEFIT_BACKUP_ENV_FILE:'/root/backup.env',ROUTEFIT_BACKUP_DIRECTORY:'/var/backups',ROUTEFIT_PG_BIN:'/opt/pg/bin'}});
 assert.match(env,/ROUTEFIT_ADMIN_ENV_FILE=\/root\/admin\.env/);assert.match(env,/ROUTEFIT_BACKUP_ENV_FILE=\/root\/backup\.env/);assert.match(env,/ROUTEFIT_TRIAL_SERVICE_AREAS_FILE=\/root\/areas\.geojson/);assert.match(env,/ROUTEFIT_PG_BIN=\/opt\/pg\/bin/);
});
test('trial staff uses the configured company id instead of the first active company',async()=>{
 const root=await mkdtemp(join(tmpdir(),'routefit-staff-')),staffFile=join(root,'staff.json'),sessionsFile=join(root,'sessions.json'),companyFile=join(root,'company.json'),adminEnv=join(root,'admin.env');
 await writeFile(staffFile,JSON.stringify([{humanId:'synthetic',sshLogin:'synthetic',roles:['order_quote']}]))
 await writeFile(sessionsFile,'[]\n');await writeFile(companyFile,JSON.stringify({id:'11111111-1111-4111-8111-111111111111'}));await writeFile(adminEnv,'ROUTEFIT_PG_ADMIN_URL=postgresql://admin@127.0.0.1/postgres\n');
 const calls=[];class FakePool{constructor(config){this.config=config;}async connect(){return {query:async(sql,params=[])=>{calls.push({sql,params});if(sql.includes('SELECT id FROM org.company'))return {rows:[{id:params[0]}]};if(sql.includes('INSERT INTO org.principal'))return {rows:[]};return {rows:[]};},release(){}};}async end(){}}
 try{await runTrialStaff({env:{ROUTEFIT_TRIAL:'1',ROUTEFIT_TRIAL_DATABASE:'routefit_trial',ROUTEFIT_SESSION_FILE:sessionsFile,ROUTEFIT_TRIAL_STAFF_FILE:staffFile,ROUTEFIT_TRIAL_COMPANY_FILE:companyFile,ROUTEFIT_ADMIN_ENV_FILE:adminEnv},Pool:FakePool});assert.deepEqual(calls.find(call=>call.sql.includes('SELECT id FROM org.company')).params,['11111111-1111-4111-8111-111111111111']);}finally{await rm(root,{recursive:true,force:true});}
});
test('backup role grants are database-local and default-readable without pg_read_all_data',async()=>{
 const calls=[],client={query:async(sql)=>{calls.push(sql);if(sql.startsWith('SELECT schema_name'))return {rows:[{schema_name:'coverage'}]};if(sql.startsWith('SELECT DISTINCT'))return {rows:[]};return {rows:[]};}};
 await configureBackupRole({client,backupRole:'rf_backup_demo'});
 assert.ok(calls.some(sql=>sql.includes('GRANT USAGE ON SCHEMA "coverage"')));
 assert.ok(calls.some(sql=>sql.includes('GRANT SELECT ON ALL TABLES IN SCHEMA "coverage"')));
 assert.ok(calls.some(sql=>sql.includes('GRANT SELECT ON ALL SEQUENCES IN SCHEMA "coverage"')));
 assert.ok(calls.some(sql=>sql.includes('ALTER DEFAULT PRIVILEGES FOR ROLE CURRENT_USER')));
 assert.ok(calls.some(sql=>sql.includes('REVOKE CREATE ON SCHEMA public FROM PUBLIC')));
 assert.ok(!calls.some(sql=>sql.includes('pg_read_all_data')));
});
test('pg_hba template limits runtime and backup roles with allow-before-reject order',async()=>{
 const text=await (await import('node:fs/promises')).readFile(new URL('../../../ops/trial/pg_hba-routefit.example',import.meta.url),'utf8');
 assert.match(text,/first matching rule/i);assert.match(text,/local\s+all\s+<RUNTIME_ROLE>\s+reject/);assert.match(text,/local\s+all\s+<BACKUP_ROLE>\s+reject/);
 for(const role of ['<RUNTIME_ROLE>','<BACKUP_ROLE>']){
  const allowLoopback=text.search(new RegExp(`host\\s+routefit_trial\\s+${role}\\s+127\\.0\\.0\\.1/32\\s+scram-sha-256`)),rejectLoopback=text.search(new RegExp(`host\\s+all\\s+${role}\\s+127\\.0\\.0\\.1/32\\s+reject`)),allowIpv6=text.search(new RegExp(`host\\s+routefit_trial\\s+${role}\\s+::1/128\\s+scram-sha-256`)),rejectIpv6=text.search(new RegExp(`host\\s+all\\s+${role}\\s+::1/128\\s+reject`));
  assert.ok(allowLoopback>=0&&allowLoopback<rejectLoopback);assert.ok(allowIpv6>=0&&allowIpv6<rejectIpv6);
 }
});
test('trial session generation stores only hashes and an expiry',()=>{
 const [session,raw,csrf]=newSession({companyId:'11111111-1111-4111-8111-111111111111',principalId:'22222222-2222-4222-8222-222222222222'},['pricing:read'],new Date(Date.now()+3600000).toISOString());
 assert.equal(session.tokenHash.length,64);assert.equal(session.csrfHash.length,64);assert.equal(session.csrf,undefined);assert.notEqual(session.token,raw);assert.notEqual(session.csrf,csrf);
});
test('renewal invalidates the old token hash while preserving service sessions',()=>{
 const old=[{authType:'staff',tokenHash:'old',csrfHash:'old',expiresAt:'2020-01-01T00:00:00.000Z'},{authType:'service',tokenHash:'service'}];
 const next=renewSessions(old,'2030-01-01T00:00:00.000Z');
 assert.notEqual(next[0].tokenHash,'old');assert.notEqual(next[0].csrfHash,'old');assert.equal(next[0].expiresAt,'2030-01-01T00:00:00.000Z');assert.deepEqual(next[1],old[1]);
});
test('staff role conflict is rejected before any database writes',()=>{
 assert.throws(()=>validateStaffAssignments([{humanId:'h1',sshLogin:'h1',roles:['policy_author','policy_reviewer']}]),/同一人/);
});
test('staff SSH logins are required and unique',()=>{
 assert.throws(()=>validateStaffAssignments([{humanId:'h1',roles:['order_quote']}]),/sshLogin/);
 assert.throws(()=>validateStaffAssignments([{humanId:'h1',sshLogin:'same',roles:['order_quote']},{humanId:'h2',sshLogin:'same',roles:['policy_reviewer']}]),/sshLogin/);
});
test('CSV parser handles quoted commas and escaped quotes',()=>{
 const rows=parseCsv('name,note\n"Acme, Inc.","say ""hello"""\n');
 assert.deepEqual(rowsToObjects(rows),[{name:'Acme, Inc.',note:'say "hello"'}]);
});
test('invalid CSV row width is rejected before transaction',()=>{
 assert.throws(()=>rowsToObjects(parseCsv('name,note\nAcme\n'),'customers.csv'),/invalid row width/);
});
test('backup and restore safety guards reject destructive targets',()=>{
 assert.throws(()=>assertBackupDirectoryOutsideRepo('/repo','/repo/backups'),/outside/);
 assert.throws(()=>assertRestoreDatabase('routefit_trial'),/usage/);
 assert.equal(assertRestoreDatabase('routefit_trial_restore_20261028'),'routefit_trial_restore_20261028');
});
test('trial backup requires an existing external directory',async()=>{
 const root=await mkdtemp(join(tmpdir(),'routefit-trial-')),missing=join(tmpdir(),`routefit-trial-missing-${Date.now()}`);try{await assert.rejects(requireExistingBackupDirectory(root,missing),/must already exist/);}finally{await rm(root,{recursive:true,force:true});}
});
test('trial backup names, modes and cleanup only cover generated files',()=>{
 const oldest=trialBackupName(new Date('2026-11-01T01:02:03.000Z')),names=[oldest,...Array.from({length:14},(_,i)=>trialBackupName(new Date(Date.UTC(2026,10,2+i,1,2,3)))),'operator-notes.dump'];
 assert.equal(oldest,'routefit_trial-20261101T010203Z.dump');assert.equal(trialBackupChecksumName(oldest),'routefit_trial-20261101T010203Z.dump.sha256');assert.equal(trialBackupUmask,0o027);assert.equal(trialBackupFileMode,0o640);
 assert.doesNotThrow(()=>assertTrialBackupFileMetadata({uid:1001,gid:1002,mode:0o100640},1001,1002));assert.throws(()=>assertTrialBackupFileMetadata({uid:1001,gid:1003,mode:0o100640},1001,1002),/ownership or mode/);assert.throws(()=>assertTrialBackupFileMetadata({uid:1001,gid:1002,mode:0o100600},1001,1002),/ownership or mode/);
 assert.deepEqual(trialBackupCleanupNames(names),[oldest,trialBackupChecksumName(oldest)]);
});
test('SSH login helper maps only registered staff names and ignores command injection',()=>{
 const people=[{principalId:'p1',sshLogin:'ops-one'},{principalId:'p2',sshLogin:'reviewer'}];
 assert.equal(resolveStaffActor(people,'ops-one'),0);
 assert.equal(resolveStaffActor(people,'reviewer'),1);
 assert.equal(resolveStaffActor(people,'ops-one 1'),-1);
 assert.equal(resolveStaffActor(people,'synthetic-reviewer'),-1);
 assert.equal(resolveStaffActor(people,'unknown'),-1);
 assert.equal(resolveStaffActor(people,''),-1);
 assert.equal(resolveStaffActor([...people,{principalId:'p3',sshLogin:'ops-one'}],'ops-one'),-1);
});
test('SSH helper reads only explicit environment settings',()=>{
 assert.deepEqual(parseEnvironment('# comment\nROUTEFIT_AUTH_MODE=development\nROUTEFIT_SESSION_FILE="/var/lib/routefit/sessions.json"\n'),{ROUTEFIT_AUTH_MODE:'development',ROUTEFIT_SESSION_FILE:'/var/lib/routefit/sessions.json'});
});
test('database CLI strips password from args and passes it only via PGPASSWORD',()=>{
 const cli=pgCliConnection('postgresql://demo:secret@127.0.0.1:5432/routefit');
 assert.equal(cli.password,'secret');assert.equal(cli.url,'postgresql://demo@127.0.0.1:5432/routefit');assert.ok(!cli.url.includes('secret'));
});
test('database CLI decodes special URL credentials without leaking either form',()=>{
 const raw='p@ss:slash/percent% space',encoded=encodeURIComponent(raw);
 const cli=pgCliConnection(`postgresql://ops%40example:${encoded}@127.0.0.1:5432/routefit`);
 assert.equal(cli.password,raw);assert.ok(!cli.url.includes(raw));assert.ok(!cli.url.includes(encoded));assert.match(cli.url,/ops%40example@/);
});
test('backup script injects exec and keeps raw and encoded passwords out of args',async()=>{
 const root=await mkdtemp(join(tmpdir(),'rf038-backup-')),dir=join(root,'backups');await import('node:fs/promises').then(({mkdir})=>mkdir(dir));
 const raw='p@ss:slash/percent% space',encoded=encodeURIComponent(raw),calls=[];
 try{
  const result=await runBackup({backupDirectory:dir,env:{ROUTEFIT_DATABASE_URL:`postgresql://ops:${encoded}@127.0.0.1:5432/routefit`},now:new Date('2026-11-01T01:02:03Z'),platform:'win32',setMetadata:async()=>{},exec:async(bin,args,options)=>{calls.push({bin,args,options});await writeFile(args[2],'synthetic dump');}});
  const flat=calls[0].args.join(' ');assert.ok(!flat.includes(raw));assert.ok(!flat.includes(encoded));assert.equal(calls[0].options.env.PGPASSWORD,raw);assert.equal((await verifyBackupChecksum(result.file,result.checksum)).length,64);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('restore verifies checksum before pool creation or exec',async()=>{
 let pools=0,execCalls=0;
 await assert.rejects(runRestore({file:'/tmp/missing.dump',database:'routefit_trial_restore_20261101',adminUrl:'postgresql://ops:secret@127.0.0.1/postgres',poolFactory:()=>{pools++;return {query:async()=>({rowCount:0}),end:async()=>{}};},exec:async()=>{execCalls++;},verifyChecksum:async()=>{throw Error('backup checksum mismatch');}}),/mismatch/);
 assert.equal(pools,0);assert.equal(execCalls,0);
});
test('restore checksum accepts matching file and rejects mismatch or missing file',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'rf038-checksum-')),file=join(dir,'backup.dump'),sum=join(dir,'backup.dump.sha256');
 try{
  await writeFile(file,'synthetic backup');
  const {createHash}=await import('node:crypto');const hash=createHash('sha256').update('synthetic backup').digest('hex');
  await writeFile(sum,`${hash}  backup.dump\n`);assert.equal((await verifyBackupChecksum(file,sum)).length,64);
  await writeFile(sum,`${'0'.repeat(64)}  backup.dump\n`);await assert.rejects(verifyBackupChecksum(file,sum),/mismatch/);
  await assert.rejects(verifyBackupChecksum(file,join(dir,'missing.sha256')));
 }finally{await rm(dir,{recursive:true,force:true});}
});
