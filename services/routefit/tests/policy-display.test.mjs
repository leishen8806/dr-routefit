import test from 'node:test';
import assert from 'node:assert/strict';
import {policyReasonSummary} from '../adapters/policy.mjs';

test('policy reason summary truncates by Unicode characters, not UTF-16 code units',()=>{
 const value='😀'.repeat(80)+'尾部不应出现';
 const summary=policyReasonSummary(value);
 assert.equal(Array.from(summary).length,80);
 assert.equal(summary,'😀'.repeat(80));
});
