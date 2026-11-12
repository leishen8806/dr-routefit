import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const specification = new URL('../../../contracts/openapi.json', import.meta.url);

test('Backend1 paths declare each operation and a validated response schema', async () => {
  const document = JSON.parse(await readFile(specification, 'utf8'));
  const expected = [
    ['/api/customer/v1/route-quotes', 'post', 'createRouteQuote', 'RouteQuote'],
    ['/api/ops/v1/route-pricing/configurations', 'get', 'listRoutePricingConfigurations', 'RoutePricingConfigurationPage'],
    ['/api/ops/v1/route-pricing/configurations', 'post', 'createRoutePricingConfiguration', 'RoutePricingConfiguration'],
    ['/api/ops/v1/coupons', 'get', 'listCoupons', 'CouponPage'],
    ['/api/ops/v1/coupons/batches', 'post', 'createCouponBatch', 'CouponBatch'],
    ['/api/customer/v1/orders/{orderId}/actions/lock-coupon', 'post', 'lockOrderCoupon', 'CouponLock'],
    ['/api/customer/v1/orders/{orderId}/actions/redeem-coupon', 'post', 'redeemOrderCoupon', 'CouponRedemption'],
    ['/api/customer/v1/orders/{orderId}/actions/release-coupon', 'post', 'releaseOrderCoupon', 'CouponRelease'],
    ['/api/ops/v1/merchants/{merchantId}/contract', 'get', 'getMerchantContract', 'MerchantContract'],
    ['/api/ops/v1/merchants/{merchantId}/contract', 'post', 'createMerchantContract', 'MerchantContract'],
    ['/api/ops/v1/merchants/{merchantId}/contract/actions/activate', 'post', 'activateMerchantContract', 'MerchantContract'],
    ['/api/ops/v1/merchants/{merchantId}/contract/actions/expire', 'post', 'expireMerchantContract', 'MerchantContract'],
    ['/api/ops/v1/merchants/{merchantId}/sku-dimensions', 'get', 'listMerchantSkuDimensions', 'SkuDimensionPage'],
    ['/api/ops/v1/merchants/{merchantId}/sku-dimensions', 'post', 'createMerchantSkuDimension', 'SkuDimension'],
    ['/api/ops/v1/users/{userId}/actions/freeze', 'post', 'freezeUser', 'UserFreezeState'],
    ['/api/ops/v1/users/{userId}/actions/unfreeze', 'post', 'unfreezeUser', 'UserFreezeState']
  ];

  for (const [path, method, operationId, responseSchema] of expected) {
    const operation = document.paths[path]?.[method];
    assert.equal(operation?.operationId, operationId, `${method.toUpperCase()} ${path}`);
    const content = Object.values(operation.responses)
      .find(response => response.content?.['application/json'])?.content?.['application/json'];
    assert.equal(content?.schema?.$ref, `#/components/schemas/${responseSchema}`, operationId);
    assert.ok(document.components.schemas[responseSchema], `missing ${responseSchema}`);
  }
});
