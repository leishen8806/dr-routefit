import test from 'node:test';
import assert from 'node:assert/strict';
import {backend1Routes} from '../application/backend1.mjs';

test('Backend1 contract routes retain the coupon batch write metadata for BackendSenior wiring', () => {
 const route=backend1Routes.find(candidate=>candidate.operation==='createCouponBatch');
 assert.equal(route.method,'POST');
 assert.equal(route.input,'CouponBatchCreate');
 assert.equal(route.schema,'CouponBatch');
 assert.equal(route.permission,'marketing:coupon:write');
});

test('Backend1 route table keeps the complete operation inventory for BackendSenior wiring', () => {
 assert.equal(backend1Routes.length,16);
 assert.deepEqual(backend1Routes.filter(route=>route.write).map(route=>route.operation),[
  'createRouteQuote','createRoutePricingConfiguration','createCouponBatch','lockOrderCoupon','redeemOrderCoupon','releaseOrderCoupon','createMerchantContract','activateMerchantContract','expireMerchantContract','createMerchantSkuDimension','freezeUser','unfreezeUser'
 ]);
});
