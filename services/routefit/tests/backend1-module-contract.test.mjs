import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const moduleFile = new URL('../../../contracts/modules/backend1.json', import.meta.url);

test('Backend1 module contract makes every owned operation reviewable under standard 20', async () => {
  const module = JSON.parse(await readFile(moduleFile, 'utf8'));

  assert.equal(module.module, 'backend1-routefit-r2');
  const requiredAOperations = [
    'listDimensionRules', 'createDimensionRule',
    'listVehicleTariffs', 'createVehicleTariff',
    'listValueAddedServices', 'createValueAddedService',
    'listFxRates', 'createFxRate', 'createPricingQuoteTrial',
    'createCustomerQuoteTrial', 'listCustomerServiceOptions'
  ];
  const requiredBOperations = [
    'listMerchants', 'createMerchant', 'getMerchant',
    'approveMerchant', 'rejectMerchant', 'suspendMerchant', 'resumeMerchant',
    'listMerchantContracts', 'createMerchantContractVersion', 'approveMerchantContract',
    'listUsers', 'getUser',
    'listCouponBatches', 'createCouponBatchBaseline', 'getCouponBatch',
    'submitCouponBatch', 'approveCouponBatch', 'rejectCouponBatch', 'stopCouponBatch',
    'listCouponRedemptions', 'listCouponRiskFlags', 'resolveCouponRiskFlag',
    'batchCreateCustomerOrders', 'listCustomerSkuDimensions', 'createCustomerSkuDimension',
    'listCustomerCoupons', 'claimCustomerCoupon', 'listCustomerCodItems',
  ];
  const moduleOperations = Object.values(module.paths)
    .flatMap(path => Object.values(path));

  assert.deepEqual(
    moduleOperations.map(operation => operation.operationId).sort(),
    [...requiredAOperations, ...requiredBOperations].sort()
  );

  for (const operation of moduleOperations) {
    assert.equal(operation['x-stage'], 'R2');
    assert.ok(['A', 'B'].includes(operation['x-baseline-tier']));
    assert.equal(operation['x-implementation-status'], 'PLANNED');
    assert.equal(operation['x-owner'], 'Backend1');
    assert.ok(operation['x-examples']?.success);
    assert.ok(operation['x-examples']?.rejected);
  }
  assert.equal(module['x-recorded-operations'].length, 16);

  for (const operation of module['x-recorded-operations']) {
    assert.ok(operation.operationId, 'operationId is required');
    assert.ok(operation.path.startsWith('/api/'), `${operation.operationId} needs an API path`);
    assert.ok(Array.isArray(operation['x-permissions']), `${operation.operationId} needs x-permissions`);
    assert.ok(operation['x-stage'], `${operation.operationId} needs a phase`);
    assert.equal(operation['x-implementation-status'], 'PLANNED');
    assert.ok(operation['x-version-resource'], `${operation.operationId} needs a version resource`);
    assert.equal(operation['x-owner'], 'Backend1');
    assert.ok(operation['x-examples']?.success, `${operation.operationId} needs a success example`);
    assert.ok(operation['x-examples']?.rejected, `${operation.operationId} needs a rejection example`);
  }
});
