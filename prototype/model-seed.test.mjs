import test from 'node:test';import assert from 'node:assert/strict';import {seed} from './model.mjs';
test('seed uses relative demo commitment times',()=>{const now=Date.parse('2026-10-27T07:00:00Z'),db=seed(now),o=db.orders.find(x=>x.id==='RF-1024-001');assert.equal(o.promise,'2026-10-27T13:42');});
