import test from 'node:test';
import assert from 'node:assert/strict';
import {rolePermissions,newSession,parseCsv,rowsToObjects,validateStaffAssignments,assertBackupDirectoryOutsideRepo,assertRestoreDatabase,renewSessions} from '../scripts/trial-common.mjs';
import {resolveStaffActor} from '../scripts/trial-ssh-link.mjs';

test('trial staff role permissions are least privilege and distinct',()=>{
 assert.ok(rolePermissions.order_quote.includes('quotes:create'));
 assert.ok(!rolePermissions.policy_reviewer.includes('pricing:write'));
 assert.ok(!rolePermissions.policy_publisher.includes('pricing:review'));
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
test('SSH login helper maps only registered staff names and ignores command injection',()=>{
 const people=[{principalId:'p1',sshLogin:'ops-one'},{principalId:'p2',sshLogin:'reviewer'}];
 assert.equal(resolveStaffActor(people,'ops-one'),0);
 assert.equal(resolveStaffActor(people,'reviewer'),1);
 assert.equal(resolveStaffActor(people,'ops-one 1'),-1);
 assert.equal(resolveStaffActor(people,'synthetic-reviewer'),-1);
 assert.equal(resolveStaffActor(people,'unknown'),-1);
});
