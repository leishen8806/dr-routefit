import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const specification = new URL('../../../contracts/openapi.json', import.meta.url);
const operations = [
  ['post', '/api/driver/v1/registration-applications', 'driverRegistrationApplicationCreate'],
  ['get', '/api/ops/v1/driver-applications', 'opsDriverApplications'],
  ['post', '/api/ops/v1/driver-applications/{applicationId}/actions/review', 'opsDriverApplicationReview'],
  ['get', '/api/driver/v1/vehicles', 'driverVehicles'],
  ['put', '/api/driver/v1/vehicles/{vehicleId}', 'driverVehicleUpdate'],
  ['post', '/api/driver/v1/vehicles/{vehicleId}/documents', 'driverVehicleDocumentCreate'],
  ['get', '/api/driver/v1/vehicles/{vehicleId}/alerts', 'driverVehicleAlerts'],
  ['post', '/api/driver/v1/vehicles/{vehicleId}/fuel-mileage-logs', 'driverFuelMileageLogCreate'],
  ['post', '/api/driver/v1/assignments/{assignmentId}/load-scans', 'driverAssignmentLoadScanCreate'],
  ['post', '/api/driver/v1/orders/{orderId}/delivery-attempts', 'driverDeliveryAttemptCreate'],
  ['post', '/api/driver/v1/delivery-attempts/{attemptId}/location-checks', 'driverDeliveryLocationCheck'],
  ['post', '/api/driver/v1/delivery-attempts/{attemptId}/undelivered-reasons', 'driverUndeliveredReasonCreate'],
  ['post', '/api/driver/v1/orders/{orderId}/collections', 'driverCollectionCreate'],
  ['get', '/api/driver/v1/cash-limit-status', 'driverCashLimitStatus']
];

test('Backend2 paths retain undecided permissions and complete response contracts', async () => {
  const document = JSON.parse(await readFile(specification, 'utf8'));

  for (const [method, path, operationId] of operations) {
    const operation = document.paths[path]?.[method];
    assert.equal(operation?.operationId, operationId, `${method.toUpperCase()} ${path}`);
    assert.deepEqual(operation['x-permissions'], []);
    assert.equal(operation['x-permissions-note'], '待 Lead 裁定');
    if (method !== 'get') assert.ok(operation.requestBody?.content?.['application/json']?.schema, `${operationId} request body`);
    for (const code of method === 'get' ? [400, 401, 403, 404, 429, 503] : [400, 401, 403, 404, 412, 428, 429, 503]) {
      assert.ok(operation.responses[code], `${operationId} ${code}`);
    }
    assert.ok(Object.entries(operation.responses).some(([code, response]) => /^2/.test(code) && response.content?.['application/json']?.schema), `${operationId} success schema`);
  }
});
