import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validate} from '../adapters/contract.mjs';

const specification = new URL('../../../contracts/openapi.json', import.meta.url);

test('Backend2 write schemas keep simulated collection, versioning, and driver evidence explicit', async () => {
  const document = JSON.parse(await readFile(specification, 'utf8'));
  const schemas = document.components.schemas;

  for (const name of [
    'DriverRegistrationApplicationCreate', 'DriverApplicationReviewAction',
    'VehicleProfileUpdate', 'VehicleDocumentCreate', 'FuelMileageLogCreate',
    'AssignmentLoadScanCreate', 'DeliveryAttemptCreate', 'LocationCheckCreate',
    'UndeliveredReasonCreate', 'CollectionCreate', 'WithdrawalRequestCreate'
  ]) assert.ok(schemas[name], `missing ${name}`);

  assert.doesNotThrow(() => validate('CollectionCreate', {
    paymentMethod: 'KHQR_SIM',
    amount: {amountMinor: 1200, currency: 'USD'},
    deliveryAttemptId: 'attempt-001'
  }));
  assert.throws(
    () => validate('CollectionCreate', {
      paymentMethod: 'BANK_TRANSFER',
      amount: {amountMinor: 12.5, currency: 'USD'},
      deliveryAttemptId: 'attempt-001'
    }),
    {code: 'VALIDATION_FAILED'}
  );
  assert.throws(
    () => validate('DriverApplicationReviewAction', {decision: 'APPROVE'}),
    {code: 'VALIDATION_FAILED'}
  );
  assert.doesNotThrow(() => validate('LocationCheckCreate', {
    observed: {lat: 11.5564, lng: 104.9282}
  }));
  assert.throws(
    () => validate('LocationCheckCreate', {
      observed: {lat: 11.5564, lng: 104.9282},
      allowedRadiusMeters: 150
    }),
    {code: 'VALIDATION_FAILED'}
  );
});
