import test from 'node:test';
import assert from 'node:assert/strict';
import {backend1Handlers,createBackend1Handlers} from '../application/backend1-handlers.mjs';
import {createCouponBatch,getMerchantContract,listCoupons,listMerchantSkuDimensions} from '../adapters/backend1.mjs';

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
 const result=await createCouponBatch({client,companyId:'00000000-0000-0000-0000-000000000001',idempotencyKey:'coupon-batch-1'},{code:'DEMO',discountType:'fixed',amountMinor:100,currency:'USD',budgetMinor:1000,startsAt:'2026-11-10T00:00:00Z',endsAt:'2026-11-11T00:00:00Z'});
 assert.deepEqual(result,{id:'00000000-0000-0000-0000-000000000010',version:1,budgetMinor:1000});
 assert.match(calls[0].sql,/INSERT INTO marketing\.coupon_batch/);
 assert.equal(calls[0].params[1],'00000000-0000-0000-0000-000000000001');
 assert.equal(calls[0].params[6],1000);
 assert.equal(calls[0].params[7],'coupon-batch-1');
});

test('coupon list repository scopes results to the company and maps issued coupons to available', async () => {
 const calls=[];
 const client={query:async(sql,params)=>{
  calls.push({sql,params});
  return {rows:[
   {id:'00000000-0000-0000-0000-000000000011',state:'ISSUED'},
   {id:'00000000-0000-0000-0000-000000000012',state:'LOCKED'}
  ]};
 }};
 const result=await listCoupons({client,companyId:'00000000-0000-0000-0000-000000000001'});
 assert.deepEqual(result,{items:[
  {id:'00000000-0000-0000-0000-000000000011',state:'AVAILABLE'},
  {id:'00000000-0000-0000-0000-000000000012',state:'LOCKED'}
 ]});
 assert.match(calls[0].sql,/WHERE company_id=\$1/);
 assert.deepEqual(calls[0].params,['00000000-0000-0000-0000-000000000001']);
});

test('merchant SKU dimension list scopes the merchant and projects chargeable weight', async () => {
 const calls=[];
 const client={query:async(sql,params)=>{
  calls.push({sql,params});
  return {rows:[{id:'00000000-0000-0000-0000-000000000013',length_cm:400,width_cm:20,height_cm:20,weight_grams:18000}]};
 }};
 const result=await listMerchantSkuDimensions({client,companyId:'00000000-0000-0000-0000-000000000001',merchantId:'00000000-0000-0000-0000-000000000002'});
 assert.deepEqual(result,{items:[{id:'00000000-0000-0000-0000-000000000013',chargeableWeightGrams:27000,exclusiveVehicleOnly:true}]});
 assert.match(calls[0].sql,/WHERE company_id=\$1 AND merchant_id=\$2/);
 assert.deepEqual(calls[0].params,['00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002']);
});

test('merchant contract read scopes the contract to its company and merchant', async () => {
 const calls=[];
 const client={query:async(sql,params)=>{
  calls.push({sql,params});
  return {rows:[{id:'00000000-0000-0000-0000-000000000014',state:'ACTIVE',version:'2'}]};
 }};
 const result=await getMerchantContract({client,companyId:'00000000-0000-0000-0000-000000000001',merchantId:'00000000-0000-0000-0000-000000000002'});
 assert.deepEqual(result,{id:'00000000-0000-0000-0000-000000000014',state:'ACTIVE',version:2});
 assert.match(calls[0].sql,/WHERE company_id=\$1 AND merchant_id=\$2/);
 assert.deepEqual(calls[0].params,['00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002']);
});

test('merchant contract read returns a not-found domain error when its company scope has no match', async () => {
 const client={query:async()=>({rows:[]})};
 await assert.rejects(()=>getMerchantContract({client,companyId:'00000000-0000-0000-0000-000000000001',merchantId:'00000000-0000-0000-0000-000000000002'}),{code:'MERCHANT_CONTRACT_NOT_FOUND'});
});

test('default Backend1 coupon batch handler uses the module repository', async () => {
 const client={query:async()=>({rows:[{id:'00000000-0000-0000-0000-000000000010',version:'1',budget_minor:'1000'}]})};
 const result=await backend1Handlers.createCouponBatch({client,companyId:'00000000-0000-0000-0000-000000000001',idempotencyKey:'coupon-batch-1'},{code:'DEMO',discountType:'fixed',amountMinor:100,currency:'USD',budgetMinor:1000,startsAt:'2026-11-10T00:00:00Z',endsAt:'2026-11-11T00:00:00Z'});
 assert.equal(result.status,201);
 assert.equal(result.body.budgetMinor,1000);
});
