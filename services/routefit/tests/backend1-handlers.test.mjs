import test from 'node:test';
import assert from 'node:assert/strict';
import {createBackend1Handlers} from '../application/backend1-handlers.mjs';

test('Backend1 handlers pass authenticated context and validated input to their repository boundary', async () => {
 const calls=[];
 const handlers=createBackend1Handlers({
  createCouponBatch:async(context,body)=>{calls.push({context,body});return {id:'00000000-0000-0000-0000-000000000010',code:body.code,state:'DRAFT',version:1};}
 });
 const context={companyId:'00000000-0000-0000-0000-000000000001',principalId:'00000000-0000-0000-0000-000000000002'};
 const body={code:'DEMO',discountType:'fixed',amountMinor:100,currency:'USD',budgetMinor:1000,startsAt:'2026-11-10T00:00:00Z',endsAt:'2026-11-11T00:00:00Z'};
 const result=await handlers.createCouponBatch(context,body);
 assert.equal(result.status,201);
 assert.equal(result.body.state,'DRAFT');
 assert.deepEqual(calls,[{context,body}]);
});

test('Backend1 handlers reject an operation without a supplied repository implementation', async () => {
 const handlers=createBackend1Handlers({});
 await assert.rejects(()=>handlers.freezeUser({},{reason:'demo'}),{code:'BACKEND1_HANDLER_UNAVAILABLE'});
});
