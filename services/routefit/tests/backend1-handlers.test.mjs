import test from 'node:test';
import assert from 'node:assert/strict';
import {backend1Handlers,createBackend1Handlers} from '../application/backend1-handlers.mjs';
import {activateMerchantContract as activateMerchantContractRepository,createCouponBatch,expireMerchantContract as expireMerchantContractRepository,freezeUser as freezeUserRepository,getMerchantContract,listCoupons,listMerchantSkuDimensions,lockOrderCoupon as lockOrderCouponRepository,redeemOrderCoupon as redeemOrderCouponRepository,releaseOrderCoupon as releaseOrderCouponRepository,unfreezeUser as unfreezeUserRepository} from '../adapters/backend1.mjs';

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

test('merchant contract activation invokes the domain transition and appends its event', async () => {
 const calls=[];
 const client={query:async(sql,params)=>{
  calls.push({sql,params});
  if(calls.length===1)return {rows:[{id:'00000000-0000-0000-0000-000000000014',state:'DRAFT',version:'2'}]};
  return {rows:[{id:'00000000-0000-0000-0000-000000000014',state:'ACTIVE',version:'3'}]};
 }};
 const result=await activateMerchantContractRepository({client,companyId:'00000000-0000-0000-0000-000000000001',merchantId:'00000000-0000-0000-0000-000000000002',version:2});
 assert.deepEqual(result,{id:'00000000-0000-0000-0000-000000000014',state:'ACTIVE',version:3});
 assert.match(calls[1].sql,/INSERT INTO party\.merchant_contract_event/);
});

test('merchant contract activation rejects a stale If-Match version before it writes', async () => {
 const client={query:async()=>({rows:[{id:'00000000-0000-0000-0000-000000000014',state:'DRAFT',version:'3'}]})};
 await assert.rejects(
  ()=>activateMerchantContractRepository({client,companyId:'00000000-0000-0000-0000-000000000001',merchantId:'00000000-0000-0000-0000-000000000002',version:2}),
  {code:'VERSION_CONFLICT'}
 );
});

test('default Backend1 activation handler uses the contract transition repository', async () => {
 const client={query:async(sql)=>{
  if(sql.trimStart().startsWith('SELECT id,state,version'))return {rows:[{id:'00000000-0000-0000-0000-000000000014',state:'DRAFT',version:'2'}]};
  return {rows:[{id:'00000000-0000-0000-0000-000000000014',state:'ACTIVE',version:'3'}]};
 }};
 const result=await backend1Handlers.activateMerchantContract({client,companyId:'00000000-0000-0000-0000-000000000001',merchantId:'00000000-0000-0000-0000-000000000002',version:2},{});
 assert.deepEqual(result,{status:200,body:{id:'00000000-0000-0000-0000-000000000014',state:'ACTIVE',version:3}});
});

test('merchant contract expiry invokes the domain transition and appends its event', async () => {
 const calls=[];
 const client={query:async(sql,params)=>{
  calls.push({sql,params});
  if(calls.length===1)return {rows:[{id:'00000000-0000-0000-0000-000000000014',state:'ACTIVE',version:'3'}]};
  return {rows:[{id:'00000000-0000-0000-0000-000000000014',state:'EXPIRED',version:'4'}]};
 }};
 const result=await expireMerchantContractRepository({client,companyId:'00000000-0000-0000-0000-000000000001',merchantId:'00000000-0000-0000-0000-000000000002',version:3});
 assert.deepEqual(result,{id:'00000000-0000-0000-0000-000000000014',state:'EXPIRED',version:4});
 assert.match(calls[1].sql,/INSERT INTO party\.merchant_contract_event/);
});

test('default Backend1 expiry handler uses the contract transition repository', async () => {
 const client={query:async(sql)=>{
  if(sql.trimStart().startsWith('SELECT id,state,version'))return {rows:[{id:'00000000-0000-0000-0000-000000000014',state:'ACTIVE',version:'3'}]};
  return {rows:[{id:'00000000-0000-0000-0000-000000000014',state:'EXPIRED',version:'4'}]};
 }};
 const result=await backend1Handlers.expireMerchantContract({client,companyId:'00000000-0000-0000-0000-000000000001',merchantId:'00000000-0000-0000-0000-000000000002',version:3},{});
 assert.deepEqual(result,{status:200,body:{id:'00000000-0000-0000-0000-000000000014',state:'EXPIRED',version:4}});
});

test('manual user freeze appends a company-scoped versioned history event', async () => {
 const calls=[];
 const client={query:async(sql,params)=>{
  calls.push({sql,params});
  if(calls.length===1)return {rows:[{action:'UNFREEZE',reason:'Previous review cleared',version:'1'}]};
  return {rows:[{principal_id:'00000000-0000-0000-0000-000000000003',action:'FREEZE',version:'2'}]};
 }};
 const result=await freezeUserRepository({client,companyId:'00000000-0000-0000-0000-000000000001',userId:'00000000-0000-0000-0000-000000000003',version:1},{reason:'Example manual review'});
 assert.deepEqual(result,{userId:'00000000-0000-0000-0000-000000000003',state:'FROZEN',version:2});
 assert.match(calls[0].sql,/WHERE company_id=\$1 AND principal_id=\$2/);
 assert.match(calls[1].sql,/INSERT INTO party\.account_freeze/);
 assert.deepEqual(calls[1].params.slice(1),['00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','Example manual review',2]);
});

test('default Backend1 freeze handler uses the append-only user freeze repository', async () => {
 const client={query:async(sql)=>{
  if(sql.includes('SELECT action,reason,version'))return {rows:[{action:'UNFREEZE',reason:'Previous review cleared',version:'1'}]};
  return {rows:[{principal_id:'00000000-0000-0000-0000-000000000003',action:'FREEZE',version:'2'}]};
 }};
 const result=await backend1Handlers.freezeUser({client,companyId:'00000000-0000-0000-0000-000000000001',userId:'00000000-0000-0000-0000-000000000003',version:1},{reason:'Example manual review'});
 assert.deepEqual(result,{status:200,body:{userId:'00000000-0000-0000-0000-000000000003',state:'FROZEN',version:2}});
});

test('manual user unfreeze appends the next company-scoped history event', async () => {
 const calls=[];
 const client={query:async(sql,params)=>{
  calls.push({sql,params});
  if(calls.length===1)return {rows:[{action:'FREEZE',reason:'Example manual review',version:'2'}]};
  return {rows:[{principal_id:'00000000-0000-0000-0000-000000000003',action:'UNFREEZE',version:'3'}]};
 }};
 const result=await unfreezeUserRepository({client,companyId:'00000000-0000-0000-0000-000000000001',userId:'00000000-0000-0000-0000-000000000003',version:2});
 assert.deepEqual(result,{userId:'00000000-0000-0000-0000-000000000003',state:'ACTIVE',version:3});
 assert.match(calls[1].sql,/INSERT INTO party\.account_freeze/);
 assert.deepEqual(calls[1].params.slice(1),['00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','Example manual review',3]);
});

test('default Backend1 unfreeze handler uses the append-only user freeze repository', async () => {
 const client={query:async(sql)=>{
  if(sql.includes('SELECT action,reason,version'))return {rows:[{action:'FREEZE',reason:'Example manual review',version:'2'}]};
  return {rows:[{principal_id:'00000000-0000-0000-0000-000000000003',action:'UNFREEZE',version:'3'}]};
 }};
 const result=await backend1Handlers.unfreezeUser({client,companyId:'00000000-0000-0000-0000-000000000001',userId:'00000000-0000-0000-0000-000000000003',version:2},{});
 assert.deepEqual(result,{status:200,body:{userId:'00000000-0000-0000-0000-000000000003',state:'ACTIVE',version:3}});
});

test('coupon lock repository runs the domain rules then atomically locks and appends history', async () => {
 const calls=[];
 const client={query:async(sql,params)=>{
  calls.push({sql,params});
  if(calls.length===1)return {rows:[{id:'00000000-0000-0000-0000-000000000010',state:'ISSUED',batch_state:'APPROVED',amount_minor:'300',minimum_spend_minor:'1000',budget_remaining_minor:'1000'}]};
  if(calls.length===2)return {rows:[{snapshot:{order:{id:'00000000-0000-0000-0000-000000000020',merchandiseMinor:1200,shippingMinor:200,insuranceMinor:100}},cod_amount_minor:'400',payment_method:'PREPAID'}]};
  if(calls.length===3)return {rows:[]};
  if(calls.length===4)return {rows:[]};
  return {rows:[{coupon_id:'00000000-0000-0000-0000-000000000010',order_id:'00000000-0000-0000-0000-000000000020',state:'LOCKED',discount_minor:'200'}]};
 }};
 const result=await lockOrderCouponRepository({client,companyId:'00000000-0000-0000-0000-000000000001',orderId:'00000000-0000-0000-0000-000000000020'},{couponId:'00000000-0000-0000-0000-000000000010'});
 assert.deepEqual(result,{couponId:'00000000-0000-0000-0000-000000000010',orderId:'00000000-0000-0000-0000-000000000020',state:'LOCKED',discountMinor:200,driverCommissionBaseMinor:1700,fraudReviewRequired:true});
 assert.match(calls[4].sql,/UPDATE marketing\.coupon/);
 assert.match(calls[4].sql,/INSERT INTO marketing\.coupon_redemption/);
});

test('default Backend1 coupon lock handler uses the coupon lock repository', async () => {
 let call=0;
 const client={query:async()=>{
  call+=1;
  if(call===1)return {rows:[{id:'00000000-0000-0000-0000-000000000010',state:'ISSUED',batch_state:'APPROVED',amount_minor:'300',minimum_spend_minor:'1000',budget_remaining_minor:'1000'}]};
  if(call===2)return {rows:[{snapshot:{order:{id:'00000000-0000-0000-0000-000000000020',merchandiseMinor:1200,shippingMinor:200,insuranceMinor:100}},cod_amount_minor:'400',payment_method:'PREPAID'}]};
  if(call<5)return {rows:[]};
  return {rows:[{coupon_id:'00000000-0000-0000-0000-000000000010',order_id:'00000000-0000-0000-0000-000000000020',state:'LOCKED',discount_minor:'200'}]};
 }};
 const result=await backend1Handlers.lockOrderCoupon({client,companyId:'00000000-0000-0000-0000-000000000001',orderId:'00000000-0000-0000-0000-000000000020'},{couponId:'00000000-0000-0000-0000-000000000010'});
 assert.deepEqual(result,{status:200,body:{couponId:'00000000-0000-0000-0000-000000000010',orderId:'00000000-0000-0000-0000-000000000020',state:'LOCKED',discountMinor:200,driverCommissionBaseMinor:1700,fraudReviewRequired:true}});
});

test('coupon redemption requires the payment-confirmed context and appends a redeemed event',async()=>{
 const calls=[];
 const client={query:async(sql,params)=>{
  calls.push({sql,params});
  if(calls.length===1)return {rows:[{id:'00000000-0000-0000-0000-000000000030',coupon_id:'00000000-0000-0000-0000-000000000010',order_id:'00000000-0000-0000-0000-000000000020',state:'LOCKED',discount_minor:'200',coupon_state:'LOCKED'}]};
  return {rows:[{id:'00000000-0000-0000-0000-000000000031',coupon_id:'00000000-0000-0000-0000-000000000010',state:'REDEEMED'}]};
 }};
 const unpaidClient={query:async()=>({rows:[{id:'00000000-0000-0000-0000-000000000030',coupon_id:'00000000-0000-0000-0000-000000000010',order_id:'00000000-0000-0000-0000-000000000020',state:'LOCKED',discount_minor:'200',coupon_state:'LOCKED'}]})};
 await assert.rejects(
  ()=>redeemOrderCouponRepository({client:unpaidClient,companyId:'00000000-0000-0000-0000-000000000001',orderId:'00000000-0000-0000-0000-000000000020'},{lockId:'00000000-0000-0000-0000-000000000030'}),
  {code:'PAYMENT_REQUIRED'}
 );
 const result=await redeemOrderCouponRepository({client,companyId:'00000000-0000-0000-0000-000000000001',orderId:'00000000-0000-0000-0000-000000000020',paymentConfirmed:true},{lockId:'00000000-0000-0000-0000-000000000030'});
 assert.deepEqual(result,{id:'00000000-0000-0000-0000-000000000031',couponId:'00000000-0000-0000-0000-000000000010',state:'REDEEMED'});
 assert.match(calls[1].sql,/INSERT INTO marketing\.coupon_redemption/);
 assert.match(calls[1].sql,/previous_redemption_id/);
});

test('coupon release appends a release event without updating redemption history',async()=>{
 const calls=[];
 const client={query:async(sql,params)=>{
  calls.push({sql,params});
  if(calls.length===1)return {rows:[{id:'00000000-0000-0000-0000-000000000031',coupon_id:'00000000-0000-0000-0000-000000000010',order_id:'00000000-0000-0000-0000-000000000020',state:'REDEEMED',discount_minor:'200',coupon_state:'REDEEMED'}]};
  return {rows:[{id:'00000000-0000-0000-0000-000000000032',coupon_id:'00000000-0000-0000-0000-000000000010',state:'RELEASED'}]};
 }};
 const result=await releaseOrderCouponRepository({client,companyId:'00000000-0000-0000-0000-000000000001',orderId:'00000000-0000-0000-0000-000000000020'},{redemptionId:'00000000-0000-0000-0000-000000000031'});
 assert.deepEqual(result,{couponId:'00000000-0000-0000-0000-000000000010',state:'RELEASED'});
 assert.match(calls[1].sql,/INSERT INTO marketing\.coupon_redemption/);
 assert.doesNotMatch(calls[1].sql,/UPDATE marketing\.coupon_redemption/);
});
