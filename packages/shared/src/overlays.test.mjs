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
  createDialogController,
  createOverlayManager,
  drawerA11yProps,
  nativeDialogA11yProps,
  nativeToastA11yProps,
  toastA11yProps,
} from './overlays.ts';
import { designTokens } from './design-tokens.ts';

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

test('exposes polite toast semantics and dialog semantics for the detail drawer', () => {
  assert.deepEqual(toastA11yProps(), { role: 'status', 'aria-live': 'polite' });
  assert.deepEqual(drawerA11yProps('job-title', 'job-detail'), {
    role: 'dialog',
    'aria-modal': true,
    'aria-labelledby': 'job-title',
    'aria-describedby': 'job-detail',
  });
});

test('maps overlay accessibility semantics for React Native consumers', () => {
  assert.deepEqual(nativeToastA11yProps(), { accessibilityLiveRegion: 'polite' });
  assert.deepEqual(nativeDialogA11yProps('Confirm collection'), {
    accessibilityLabel: 'Confirm collection',
    accessibilityRole: 'alert',
    accessibilityViewIsModal: true,
  });
});

test('defines a translucent scrim token for native modal backdrops', () => {
  assert.match(designTokens.color.scrim, /^rgba\(/);
});

test('moves focus into a confirmation dialog, traps Tab, and returns it on Escape', () => {
  const focusLog = [];
  const trigger = { focus: () => focusLog.push('trigger') };
  const first = { focus: () => focusLog.push('first') };
  const last = { focus: () => focusLog.push('last') };
  let cancelled = 0;
  const dialog = createDialogController({
    titleId: 'confirm-title',
    descriptionId: 'confirm-copy',
    trigger,
    focusables: [first, last],
    onCancel: () => cancelled++,
  });

  dialog.open();
  assert.deepEqual(dialog.props, {
    role: 'dialog',
    'aria-modal': true,
    'aria-labelledby': 'confirm-title',
    'aria-describedby': 'confirm-copy',
  });
  assert.deepEqual(focusLog, ['first']);

  let prevented = false;
  dialog.onKeyDown({ key: 'Tab', target: last, preventDefault: () => (prevented = true) });
  assert.equal(prevented, true);
  assert.deepEqual(focusLog, ['first', 'first']);

  dialog.onKeyDown({ key: 'Escape', target: first, preventDefault: () => {} });
  assert.equal(dialog.isOpen(), false);
  assert.equal(cancelled, 1);
  assert.deepEqual(focusLog, ['first', 'first', 'trigger']);
});

test('keeps Tab inside a dialog when focus starts on its container', () => {
  const focusLog = [];
  const container = { focus: () => focusLog.push('container') };
  const first = { focus: () => focusLog.push('first') };
  const last = { focus: () => focusLog.push('last') };
  const dialog = createDialogController({
    titleId: 'container-title',
    container,
    focusables: [first, last],
  });

  dialog.open();
  let prevented = false;
  dialog.onKeyDown({ key: 'Tab', target: container, preventDefault: () => (prevented = true) });

  assert.equal(prevented, true);
  assert.deepEqual(focusLog, ['first', 'first']);
});

test('keeps only one dialog open at a time', () => {
  const manager = createOverlayManager();
  const first = createDialogController({ titleId: 'first-title' });
  const second = createDialogController({ titleId: 'second-title' });

  manager.open(first);
  manager.open(second);

  assert.equal(first.isOpen(), false);
  assert.equal(second.isOpen(), true);
});
