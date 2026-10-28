import test from 'node:test';
import assert from 'node:assert/strict';
import {rolePermissions,newSession} from '../scripts/trial-common.mjs';

test('trial staff role permissions are least privilege and distinct',()=>{
 assert.ok(rolePermissions.order_quote.includes('quotes:create'));
 assert.ok(!rolePermissions.policy_reviewer.includes('pricing:write'));
 assert.ok(!rolePermissions.policy_publisher.includes('pricing:review'));
});
test('trial session generation stores only hashes and an expiry',()=>{
 const [session,raw,csrf]=newSession({companyId:'11111111-1111-4111-8111-111111111111',principalId:'22222222-2222-4222-8222-222222222222'},['pricing:read'],new Date(Date.now()+3600000).toISOString());
 assert.equal(session.tokenHash.length,64);assert.equal(session.csrfHash.length,64);assert.equal(session.csrf,undefined);assert.notEqual(session.token,raw);assert.notEqual(session.csrf,csrf);
});
