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

  const baselineOperations = requiredAOperations.map(operationId => {
    const operation = moduleOperations.find(candidate => candidate.operationId === operationId);
    assert.ok(operation, `missing baseline operation ${operationId}`);
    return operation;
  });
  for (const operation of baselineOperations) {
    assert.ok(
      operation.parameters.some(parameter => parameter.$ref === '../common.json#/components/parameters/AcceptLanguage'),
      `${operation.operationId} must reuse the public Accept-Language parameter`
    );
    const success = Object.entries(operation.responses)
      .find(([status]) => /^2/.test(status))?.[1];
    assert.ok(success, `${operation.operationId} needs a successful response`);
    assert.deepEqual(
      success.headers,
      {
        'X-Request-Id': {$ref: '../common.json#/components/headers/XRequestId'},
        'Cache-Control': {$ref: '../common.json#/components/headers/CacheControl'},
        ETag: {$ref: '../common.json#/components/headers/ETag'}
      },
      `${operation.operationId} must reuse the standard success headers`
    );
  }

  for (const operation of baselineOperations.filter(operation => operation.operationId.startsWith('create'))) {
    const idempotency = operation.parameters.find(parameter => parameter.$ref === '../common.json#/components/parameters/IdempotencyKey');
    assert.deepEqual(idempotency, {$ref: '../common.json#/components/parameters/IdempotencyKey'});
  }

  for (const operationId of ['createPricingQuoteTrial', 'createCustomerQuoteTrial']) {
    const operation = baselineOperations.find(candidate => candidate.operationId === operationId);
    assert.equal(operation['x-examples'].rejected.code, 'OVERSIZE_REQUIRES_CHARTER');
  }
  assert.deepEqual(
    baselineOperations.find(operation => operation.operationId === 'createCustomerQuoteTrial')['x-permissions'],
    ['customer:quotes:trial']
  );
  assert.deepEqual(
    baselineOperations.find(operation => operation.operationId === 'listCustomerServiceOptions')['x-permissions'],
    ['customer:service-options:read']
  );

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
