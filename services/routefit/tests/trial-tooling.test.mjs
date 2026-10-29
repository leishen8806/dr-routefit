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

test('trial staff role permissions are least privilege and distinct',()=>{
 assert.ok(rolePermissions.order_quote.includes('quotes:create'));
 assert.ok(!rolePermissions.policy_reviewer.includes('pricing:write'));
 assert.ok(!rolePermissions.policy_publisher.includes('pricing:review'));
});
test('trial tooling defaults all database targets to routefit_trial',()=>{
 assert.equal(trialDatabaseName({}),'routefit_trial');
 assert.equal(trialDatabaseName({ROUTEFIT_TRIAL_DATABASE:'routefit_custom'}),'routefit_custom');
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
