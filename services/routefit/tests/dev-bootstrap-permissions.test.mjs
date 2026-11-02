import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDevelopmentPermissionSets,developmentOrderQuotePermissions,developmentBootstrapCaseDeciderPermissions} from '../db/dev-bootstrap-permissions.mjs';
import {developmentPermissions} from '../adapters/development-auth.mjs';
import {rolePermissions} from '../scripts/trial-common.mjs';

test('dev bootstrap preserves existing six identities and appends workflow identities',()=>{
 const base=developmentPermissions.filter(p=>!['pricing:review','pricing:publish','prepayment:verify','prepayment:review','prepayment:approve','prepayment:post'].includes(p));
 const sets=buildDevelopmentPermissionSets(base);
 assert.equal(sets.length,8);
 assert.deepEqual(sets.slice(0,2),[base,base]);
 assert.deepEqual(sets.slice(2,6),[
  ['pricing:read','pricing:review'],
  ['pricing:read','pricing:publish'],
  ['prepayment:read','prepayment:verify','prepayment:review'],
  ['prepayment:read','prepayment:approve','prepayment:post']
 ]);
 assert.equal(sets.filter(p=>p.includes('cases:create')&&!p.includes('cases:decide')).length,1);
 assert.equal(sets.filter(p=>p.includes('cases:decide')&&!p.includes('cases:create')).length,1);
 assert.deepEqual(sets[6],developmentOrderQuotePermissions);
 assert.deepEqual(sets[7],developmentBootstrapCaseDeciderPermissions);
 assert.deepEqual(sets[6],rolePermissions.order_quote);
 assert.deepEqual(sets[7],rolePermissions.case_decider);
 assert.deepEqual(rolePermissions.case_decider,['cases:read','cases:decide','orders:read','quotes:read','areas:read']);
 assert.equal(sets[6].includes('cases:decide'),false);
 assert.equal(sets[7].includes('cases:create'),false);
});
