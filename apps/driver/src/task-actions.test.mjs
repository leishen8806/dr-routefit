import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TASK_CHANGED,
  TASK_NOT_FOUND,
  actionErrorCode,
  createActionPlan,
  createEvidenceActionPlan,
  rejectConfirmationStep,
} from './task-actions.mjs';
import { errorText } from './messages.ts';

const assignment = { id: 'assignment-1', version: 7, planVersion: 4 };

test('each write action gets a unique idempotency key', () => {
  const first = createActionPlan({ action: 'accept', assignment, keyFactory: () => 'idem-key-00000001' });
  const second = createActionPlan({ action: 'accept', assignment, keyFactory: () => 'idem-key-00000002' });
  assert.notEqual(first.idempotencyKey, second.idempotencyKey);
});

test('action plan uses assignment version for If-Match', () => {
  const plan = createActionPlan({ action: 'accept', assignment, keyFactory: () => 'idem-key-00000001' });
  assert.equal(plan.ifMatch, '"7"');
  assert.deepEqual(plan.body, { planVersion: 4 });
});

test('action plan prefers the response ETag over the assignment version', () => {
  const plan = createActionPlan({ action: 'accept', assignment, etag: '"server-etag"', keyFactory: () => 'idem-key-00000001' });
  assert.equal(plan.ifMatch, '"server-etag"');
});

test('evidence action keeps the resource version and evidence together', () => {
  const plan = createEvidenceActionPlan({
    resource: { version: 3 },
    etag: '"server-etag"',
    reason: 'synthetic custody confirmation',
    evidenceFileId: '11111111-1111-4111-8111-111111111111',
    keyFactory: () => 'idem-key-00000001',
  });
  assert.equal(plan.ifMatch, '"server-etag"');
  assert.equal(plan.idempotencyKey, 'idem-key-00000001');
  assert.deepEqual(plan.body, {
    reason: 'synthetic custody confirmation',
    evidenceFileIds: ['11111111-1111-4111-8111-111111111111'],
  });
});

test('stale and hidden tasks have stable messages', () => {
  assert.equal(actionErrorCode(409), TASK_CHANGED);
  assert.equal(actionErrorCode(412), TASK_CHANGED);
  assert.equal(actionErrorCode(404), TASK_NOT_FOUND);
});

test('English UI localizes 404 and 412 error codes', () => {
  assert.equal(errorText('en', actionErrorCode(404)), 'Assignment is unavailable or no longer belongs to you');
  assert.equal(errorText('en', actionErrorCode(412)), 'Assignment has changed');
});

test('reject requires a second confirmation', () => {
  assert.equal(rejectConfirmationStep(false), 'confirm');
  assert.equal(rejectConfirmationStep(true), 'submit');
  const plan = createActionPlan({
    action: 'reject',
    assignment,
    reason: 'synthetic reason',
    keyFactory: () => 'idem-key-00000001',
  });
  assert.deepEqual(plan.body, { reason: 'synthetic reason' });
});
