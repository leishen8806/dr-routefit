import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TASK_CHANGED,
  TASK_NOT_FOUND,
  actionErrorMessage,
  createActionPlan,
  rejectConfirmationStep,
  sendWithNetworkRetry,
} from './task-actions.mjs';

const assignment = { id: 'assignment-1', version: 7, planVersion: 4 };

test('each action gets a key and a network retry reuses it', async () => {
  const first = createActionPlan({ action: 'accept', assignment, keyFactory: () => 'idem-key-00000001' });
  const second = createActionPlan({ action: 'accept', assignment, keyFactory: () => 'idem-key-00000002' });
  assert.notEqual(first.idempotencyKey, second.idempotencyKey);

  const seen = [];
  const result = await sendWithNetworkRetry(first, async (plan) => {
    seen.push(plan.idempotencyKey);
    if (seen.length === 1) throw new TypeError('network unavailable');
    return 'ok';
  });
  assert.equal(result, 'ok');
  assert.deepEqual(seen, ['idem-key-00000001', 'idem-key-00000001']);
});

test('action plan uses assignment version for If-Match', () => {
  const plan = createActionPlan({ action: 'accept', assignment, keyFactory: () => 'idem-key-00000001' });
  assert.equal(plan.ifMatch, '"7"');
  assert.deepEqual(plan.body, { planVersion: 4 });
});

test('stale and hidden tasks have stable messages', () => {
  assert.equal(actionErrorMessage(409), TASK_CHANGED);
  assert.equal(actionErrorMessage(412), TASK_CHANGED);
  assert.equal(actionErrorMessage(404), TASK_NOT_FOUND);
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
