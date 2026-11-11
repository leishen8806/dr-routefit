import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const moduleFile = new URL('../../../contracts/modules/backend1.json', import.meta.url);

test('Backend1 module contract makes every owned operation reviewable under standard 20', async () => {
  const module = JSON.parse(await readFile(moduleFile, 'utf8'));

  assert.equal(module.owner, 'Backend1');
  assert.equal(module.operations.length, 16);

  for (const operation of module.operations) {
    assert.ok(operation.operationId, 'operationId is required');
    assert.ok(operation.path.startsWith('/api/'), `${operation.operationId} needs an API path`);
    assert.ok(Array.isArray(operation['x-permissions']), `${operation.operationId} needs x-permissions`);
    assert.ok(operation.phase, `${operation.operationId} needs a phase`);
    assert.ok(operation.implementationStatus, `${operation.operationId} needs implementation status`);
    assert.ok(operation.versionObject, `${operation.operationId} needs a version object`);
    assert.equal(operation['x-owner'], 'Backend1');
    assert.ok(operation.examples?.success, `${operation.operationId} needs a success example`);
    assert.ok(operation.examples?.rejected, `${operation.operationId} needs a rejection example`);
  }
});
