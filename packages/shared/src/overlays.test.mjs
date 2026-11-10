import assert from 'node:assert/strict';
import test from 'node:test';

import {
  confirmationState,
  createToastState,
  detailDrawerState,
  dismissToast,
  enqueueToast,
  loadingState,
  adSlotState,
} from './overlays.ts';

test('queues a second toast until the active toast is dismissed', () => {
  const first = enqueueToast(createToastState(), { id: 'saved', message: 'Saved' });
  const second = enqueueToast(first, { id: 'offline', message: 'Offline' });

  assert.equal(second.active.id, 'saved');
  assert.deepEqual(second.queue, [{ id: 'offline', message: 'Offline' }]);
  assert.equal(dismissToast(second).active.id, 'offline');
});

test('requires an armed confirmation before an irreversible action may submit', () => {
  assert.deepEqual(confirmationState(false), { step: 'confirm', canSubmit: false });
  assert.deepEqual(confirmationState(true), { step: 'submit', canSubmit: true });
});

test('opens a detail drawer only when a record is provided', () => {
  assert.deepEqual(detailDrawerState(null), { open: false, record: null });
  assert.deepEqual(detailDrawerState({ id: 'task-demo-1' }), {
    open: true,
    record: { id: 'task-demo-1' },
  });
});

test('uses the calm loader treatment when reduced motion is requested', () => {
  assert.deepEqual(loadingState(false), { animation: 'rf-write', durationMs: 1800 });
  assert.deepEqual(loadingState(true), { animation: 'rf-calm', durationMs: 1600 });
});

test('labels a visible ad slot and keeps hidden slots inert', () => {
  assert.deepEqual(adSlotState(true), { visible: true, label: '广告' });
  assert.deepEqual(adSlotState(false), { visible: false, label: null });
});
