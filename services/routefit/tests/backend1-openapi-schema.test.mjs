import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validate} from '../adapters/contract.mjs';

const specification = new URL('../../../contracts/openapi.json', import.meta.url);

test('Backend1 write schemas keep versioned pricing and coupon safety explicit', async () => {
  const document = JSON.parse(await readFile(specification, 'utf8'));
  const schemas = document.components.schemas;

  for (const name of [
    'RouteQuoteCreate', 'RoutePricingConfigurationCreate', 'CouponBatchCreate',
    'CouponLockAction', 'CouponRedeemAction', 'CouponReleaseAction',
    'MerchantContractCreate', 'MerchantContractTransitionAction',
    'SkuDimensionCreate', 'UserFreezeAction', 'UserUnfreezeAction'
  ]) assert.ok(schemas[name], `missing ${name}`);

  assert.doesNotThrow(() => validate('CouponLockAction', {couponId: 'demo-001'}));
  assert.throws(
    () => validate('MerchantContractTransitionAction', {version: 0}),
    {code: 'VALIDATION_FAILED'}
  );
  assert.throws(
    () => validate('UserFreezeAction', {version: 1}),
    {code: 'VALIDATION_FAILED'}
  );
});
