import test from 'node:test';
import assert from 'node:assert/strict';
import {backend1Handlers,createBackend1Handlers} from '../application/backend1-handlers.mjs';
import {createCouponBatch} from '../adapters/backend1.mjs';

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

test('coupon batch repository stores integer budget in the company scope and returns the contract projection', async () => {
 const calls=[];
 const client={query:async(sql,params)=>{calls.push({sql,params});return {rows:[{id:'00000000-0000-0000-0000-000000000010',version:'1',budget_minor:'1000'}]};}};
 const result=await createCouponBatch({client,companyId:'00000000-0000-0000-0000-000000000001'},{code:'DEMO',discountType:'fixed',amountMinor:100,currency:'USD',budgetMinor:1000,startsAt:'2026-11-10T00:00:00Z',endsAt:'2026-11-11T00:00:00Z'});
 assert.deepEqual(result,{id:'00000000-0000-0000-0000-000000000010',version:1,budgetMinor:1000});
 assert.match(calls[0].sql,/INSERT INTO marketing\.coupon_batch/);
 assert.equal(calls[0].params[1],'00000000-0000-0000-0000-000000000001');
 assert.equal(calls[0].params[6],1000);
});

test('default Backend1 coupon batch handler uses the module repository', async () => {
 const client={query:async()=>({rows:[{id:'00000000-0000-0000-0000-000000000010',version:'1',budget_minor:'1000'}]})};
 const result=await backend1Handlers.createCouponBatch({client,companyId:'00000000-0000-0000-0000-000000000001'},{code:'DEMO',discountType:'fixed',amountMinor:100,currency:'USD',budgetMinor:1000,startsAt:'2026-11-10T00:00:00Z',endsAt:'2026-11-11T00:00:00Z'});
 assert.equal(result.status,201);
 assert.equal(result.body.budgetMinor,1000);
});
