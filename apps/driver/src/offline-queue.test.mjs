import assert from 'node:assert/strict';
import test from 'node:test';

import { createOfflineEventQueue, openOfflineEventQueue } from './offline-queue.mjs';

const input = (eventId) => ({
  eventId,
  assignmentId: 'assignment-1',
  assignmentVersion: 1,
  planVersion: 1,
  type: 'ARRIVED',
  observedAt: '2026-11-07T00:00:00.000Z',
  payload: { point: { lat: 11.5, lng: 104.9 }, evidenceFileIds: [] },
});

test('restores queued events and nextSequence after reopening', async () => {
  let stored = null;
  const store = { load: async () => stored, save: async (value) => { stored = structuredClone(value); } };
  const first = await openOfflineEventQueue(store);
  await first.enqueue(input('event-1'));
  await first.enqueue(input('event-2'));
  const reopened = await openOfflineEventQueue(store);
  assert.deepEqual(reopened.snapshot().events.map(({ sequence }) => sequence), [1, 2]);
  assert.equal((await reopened.enqueue(input('event-3'))).sequence, 3);
});

test('does not mutate memory when the transactional save fails', async () => {
  const queue = createOfflineEventQueue(undefined, { persist: async () => { throw new Error('transaction failed'); } });
  await assert.rejects(queue.enqueue(input('event-1')), /transaction failed/);
  assert.deepEqual(queue.snapshot().events, []);
  assert.equal(queue.snapshot().nextSequence, 1);
});

test('dequeues APPLIED and DUPLICATE results in sequence order', async () => {
  const queue = createOfflineEventQueue();
  await queue.enqueue(input('event-1'));
  await queue.enqueue(input('event-2'));
  const sent = [];
  const result = await queue.replay(async (event) => {
    sent.push(event.sequence);
    return { eventId: event.eventId, result: event.sequence === 1 ? 'APPLIED' : 'DUPLICATE', errorCode: null };
  });
  assert.deepEqual(sent, [1, 2]);
  assert.deepEqual(result, { accepted: 2, quarantined: 0, delayed: false, retryAfterMs: 0 });
  assert.equal(queue.snapshot().nextSequence, 3);
});

test('quarantines permanent rejection without blocking the next event', async () => {
  const queue = createOfflineEventQueue();
  await queue.enqueue(input('event-1'));
  await queue.enqueue(input('event-2'));
  const result = await queue.replay(async (event) => ({
    eventId: event.eventId,
    result: event.sequence === 1 ? 'REJECTED' : 'APPLIED',
    errorCode: event.sequence === 1 ? 'SYNC_ASSIGNMENT_VERSION_STALE' : null,
  }));
  assert.deepEqual(result, { accepted: 1, quarantined: 1, delayed: false, retryAfterMs: 0 });
  assert.equal(queue.snapshot().quarantined.length, 1);
  assert.deepEqual(queue.snapshot().events, []);
});

test('keeps a non-advancing server rejection at the head', async () => {
  const queue = createOfflineEventQueue();
  await queue.enqueue(input('event-1'));
  const result = await queue.replay(async (event) => ({
    eventId: event.eventId,
    result: 'REJECTED',
    errorCode: 'SYNC_SEQUENCE_INVALID',
  }));
  assert.deepEqual(result, { accepted: 0, quarantined: 0, delayed: true, retryAfterMs: 1000 });
  assert.equal(queue.snapshot().events.length, 1);
  assert.equal(queue.snapshot().quarantined.length, 0);
});

test('keeps a temporary failure at the head and applies exponential backoff', async () => {
  let currentTime = 10000;
  const queue = createOfflineEventQueue(undefined, { now: () => currentTime, baseDelayMs: 1000 });
  await queue.enqueue(input('event-1'));
  const send = async () => { throw Object.assign(new Error('temporary'), { status: 503 }); };
  assert.deepEqual(await queue.replay(send), { accepted: 0, quarantined: 0, delayed: true, retryAfterMs: 1000 });
  assert.equal(queue.snapshot().events.length, 1);
  assert.equal(queue.snapshot().retries['event-1'].nextAttemptAt, 11000);
  assert.deepEqual(await queue.replay(async () => assert.fail('must not retry early')), { accepted: 0, quarantined: 0, delayed: true, retryAfterMs: 1000 });
  currentTime = 11000;
  assert.deepEqual(await queue.replay(send), { accepted: 0, quarantined: 0, delayed: true, retryAfterMs: 2000 });
  assert.equal(queue.snapshot().retries['event-1'].nextAttemptAt, 13000);
});

test('reuses the same eventId and content after a retry', async () => {
  let currentTime = 0;
  const queue = createOfflineEventQueue(undefined, { now: () => currentTime });
  const original = await queue.enqueue(input('event-1'));
  await queue.replay(async () => { throw new TypeError('offline'); });
  currentTime = 1000;
  let resent;
  await queue.replay(async (event) => {
    resent = event;
    return { eventId: event.eventId, result: 'DUPLICATE', errorCode: null };
  });
  assert.deepEqual(resent, original);
});

test('deduplicates equivalent nested content and refuses other offline event types', async () => {
  const queue = createOfflineEventQueue();
  const first = await queue.enqueue(input('event-1'));
  const duplicate = await queue.enqueue({
    payload: { evidenceFileIds: [], point: { lng: 104.9, lat: 11.5 } },
    observedAt: first.observedAt,
    type: 'ARRIVED',
    planVersion: 1,
    assignmentVersion: 1,
    assignmentId: first.assignmentId,
    eventId: first.eventId,
  });
  assert.deepEqual(duplicate, first);
  await assert.rejects(queue.enqueue({ ...input('event-2'), type: 'DEPARTED' }), /Only ARRIVED/);
});

test('persists only fields required by the sync contract', async () => {
  const queue = createOfflineEventQueue();
  await queue.enqueue({
    ...input('event-1'),
    token: 'must-not-persist',
    customer: { name: 'must-not-persist', address: 'must-not-persist' },
  });
  const stored = JSON.stringify(queue.snapshot());
  assert.doesNotMatch(stored, /must-not-persist|token|customer|address/);
});
