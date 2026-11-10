import assert from 'node:assert/strict';
import test from 'node:test';

import {
  collectionState,
  deliveryProofState,
  fulfillmentStep,
  offlineNotice,
} from './fulfillment.mjs';

test('maps active fulfillment work to the warehouse, delivery, and proof steps', () => {
  assert.equal(fulfillmentStep('to_warehouse'), 'warehouse');
  assert.equal(fulfillmentStep('loading'), 'load_scan');
  assert.equal(fulfillmentStep('delivering'), 'delivery');
  assert.equal(fulfillmentStep('delivered'), 'delivery_proof');
});

test('requires a scan and location verification before delivery proof can submit', () => {
  assert.deepEqual(deliveryProofState('', false), { canSubmit: false, missing: ['scan', 'location'] });
  assert.deepEqual(deliveryProofState('PKG-EXAMPLE-01', true), { canSubmit: true, missing: [] });
});

test('marks cash and KHQR collection as non-live examples', () => {
  assert.deepEqual(collectionState('cash'), { method: 'cash', live: false, label: '示例' });
  assert.deepEqual(collectionState('khqr'), { method: 'khqr', live: false, label: '示例' });
});

test('shows an offline notice without attempting a network fallback', () => {
  assert.deepEqual(offlineNotice(false), { visible: false, message: null });
  assert.deepEqual(offlineNotice(true), { visible: true, message: '当前离线，操作将等待网络恢复后同步。' });
});
