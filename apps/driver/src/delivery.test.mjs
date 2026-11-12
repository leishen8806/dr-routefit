import assert from 'node:assert/strict';
import test from 'node:test';

import {
  deliveryConfirmationStep,
  packageSelection,
  uploadTicketForPhoto,
  validateEvidencePhoto,
} from './delivery.mjs';
import { fetchWithTimeout } from './driver-api.ts';

const sha256 = 'a'.repeat(64);

test('validates compressed evidence format, size, and SHA-256', () => {
  assert.equal(validateEvidencePhoto({ mimeType: 'image/jpeg', sizeBytes: 1024, sha256 }), true);
  assert.throws(() => validateEvidencePhoto({ mimeType: 'image/gif', sizeBytes: 1024, sha256 }), /type/);
  assert.throws(() => validateEvidencePhoto({ mimeType: 'image/jpeg', sizeBytes: 10 * 1024 * 1024 + 1, sha256 }), /size/);
  assert.throws(() => validateEvidencePhoto({ mimeType: 'image/jpeg', sizeBytes: 1024, sha256: 'bad' }), /SHA/);
});

test('requires every package to be selected and preserves partial delivery', () => {
  const incomplete = packageSelection(['p1', 'p2'], { p1: 'delivered' });
  assert.equal(incomplete.complete, false);
  assert.deepEqual(incomplete.unresolved, ['p2']);
  const partial = packageSelection(['p1', 'p2'], { p1: 'delivered', p2: 'remaining' });
  assert.deepEqual(partial, { complete: true, deliveredPackageIds: ['p1'], remainingPackageIds: ['p2'], unresolved: [] });
});

test('delivery submission requires a second confirmation', () => {
  assert.equal(deliveryConfirmationStep(false), 'confirm');
  assert.equal(deliveryConfirmationStep(true), 'submit');
});

test('retrying the same photo reuses the upload ticket', async () => {
  let created = 0;
  const factory = async () => ({ id: `ticket-${++created}` });
  const first = await uploadTicketForPhoto(null, factory);
  const second = await uploadTicketForPhoto(first, factory);
  assert.equal(first, second);
  assert.equal(created, 1);
});

test('request timeout aborts once and does not retry a write', async () => {
  let attempts = 0;
  const fetcher = async (_input, init) => {
    attempts += 1;
    return await new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    });
  };
  await assert.rejects(fetchWithTimeout('http://127.0.0.1/', { method: 'POST' }, 1, fetcher), (error) => error.code === 'REQUEST_TIMEOUT');
  assert.equal(attempts, 1);
});
