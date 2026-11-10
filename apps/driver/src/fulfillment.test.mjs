import assert from 'node:assert/strict';
import test from 'node:test';

import {
  collectionState,
  collectionConfirmationState,
  collectionDialogResult,
  deliveryProofState,
  deliverySubmissionState,
  fulfillmentStep,
  fulfillmentSections,
  fulfillmentStatusPresentation,
  offlineNotice,
  problemReportState,
  undeliveredReasonState,
} from './fulfillment.mjs';

test('maps persisted order fulfillment stages to the driver steps', () => {
  assert.equal(fulfillmentStep('none'), 'warehouse');
  assert.equal(fulfillmentStep('pickup_pending'), 'load_scan');
  assert.equal(fulfillmentStep('picked_up'), 'delivery');
  assert.equal(fulfillmentStep('in_transit'), 'delivery');
  assert.equal(fulfillmentStep('delivery_recorded'), 'delivery_proof');
});

test('requires a scan and location verification before delivery proof can submit', () => {
  assert.deepEqual(deliveryProofState('', false), { canSubmit: false, missing: ['scan', 'location'] });
  assert.deepEqual(deliveryProofState('PKG-EXAMPLE-01', true), { canSubmit: true, missing: [] });
});

test('requires local scan, location confirmation, and evidence before delivery submission', () => {
  assert.deepEqual(deliverySubmissionState({ scanCode: ' ', locationVerified: false, evidenceReady: false }), {
    canSubmit: false,
    missing: ['scan', 'location', 'evidence'],
  });
  assert.deepEqual(deliverySubmissionState({ scanCode: 'PKG-EXAMPLE-01', locationVerified: true, evidenceReady: true }), {
    canSubmit: true,
    missing: [],
  });
});

test('marks cash and KHQR collection as non-live examples', () => {
  assert.deepEqual(collectionState('cash'), { method: 'cash', live: false, label: '示例' });
  assert.deepEqual(collectionState('khqr'), { method: 'khqr', live: false, label: '示例' });
});

test('requires an explicit second confirmation before recording a demo collection', () => {
  assert.deepEqual(collectionConfirmationState('cash', false), {
    method: 'cash',
    live: false,
    label: '示例',
    confirmationRequired: true,
    canRecord: false,
  });
  assert.deepEqual(collectionConfirmationState('khqr', true), {
    method: 'khqr',
    live: false,
    label: '示例',
    confirmationRequired: true,
    canRecord: true,
  });
  assert.deepEqual(collectionConfirmationState('cash', true, true), {
    method: 'cash',
    live: false,
    label: '示例',
    confirmationRequired: true,
    canRecord: false,
  });
});

test('treats escape as cancel for example collection confirmation', () => {
  assert.deepEqual(collectionDialogResult('cancel'), { closeDialog: true, record: false });
  assert.deepEqual(collectionDialogResult('escape'), { closeDialog: true, record: false });
  assert.deepEqual(collectionDialogResult('confirm'), { closeDialog: true, record: true });
});

test('shows an offline notice without attempting a network fallback', () => {
  assert.deepEqual(offlineNotice(false), { visible: false, message: null });
  assert.deepEqual(offlineNotice(true), { visible: true, message: '当前离线，操作将等待网络恢复后同步。' });
});

test('requires a selected undelivered reason before a partial delivery can submit', () => {
  assert.deepEqual(undeliveredReasonState(''), { canSubmit: false, reason: null });
  assert.deepEqual(undeliveredReasonState('recipient_unavailable'), { canSubmit: true, reason: 'recipient_unavailable' });
});

test('requires a non-empty problem report summary', () => {
  assert.deepEqual(problemReportState('   '), { canSubmit: false, summary: null });
  assert.deepEqual(problemReportState('收件人地址无法进入'), { canSubmit: true, summary: '收件人地址无法进入' });
});

test('exposes the correct fulfillment page sections for delivery work', () => {
  assert.deepEqual(fulfillmentSections('pickup_pending'), ['warehouse', 'load_scan', 'offline']);
  assert.deepEqual(fulfillmentSections('in_transit'), ['delivery', 'delivery_scan', 'location_check', 'collection', 'problem_report', 'offline']);
});

test('provides a localized fulfillment status for the driver detail screen', () => {
  assert.deepEqual(fulfillmentStatusPresentation('pickup_pending', 'zh-Hans'), {
    step: 'load_scan',
    label: '扫码装车',
  });
  assert.deepEqual(fulfillmentStatusPresentation('in_transit', 'en'), {
    step: 'delivery',
    label: 'Delivering',
  });
  assert.deepEqual(fulfillmentStatusPresentation('delivery_recorded', 'km'), {
    step: 'delivery_proof',
    label: 'Delivery scan',
  });
});
