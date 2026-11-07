import assert from 'node:assert/strict';
import test from 'node:test';

import { createOfflineEventQueue } from './offline-queue.mjs';

const input = (eventId) => ({
  eventId,
  assignmentId: 'assignment-1',
  type: 'ARRIVED',
  observedAt: '2026-11-07T00:00:00.000Z',
  payload: {},
});

test('assigns a continuous sequence', () => {
  const queue = createOfflineEventQueue();
  assert.equal(queue.enqueue(input('event-1')).sequence, 1);
  assert.equal(queue.enqueue(input('event-2')).sequence, 2);
  assert.deepEqual(queue.snapshot().events.map(({ sequence }) => sequence), [1, 2]);
});

test('deduplicates an eventId and rejects conflicting content', () => {
  const queue = createOfflineEventQueue();
  const first = queue.enqueue(input('event-1'));
  assert.deepEqual(queue.enqueue(input('event-1')), first);
  assert.equal(queue.snapshot().events.length, 1);
  assert.throws(
    () => queue.enqueue({ ...input('event-1'), type: 'DEPARTED' }),
    /conflicts/,
  );
});

test('keeps unsent events after a network failure and replays them in order', async () => {
  const queue = createOfflineEventQueue();
  queue.enqueue(input('event-1'));
  queue.enqueue(input('event-2'));
  queue.enqueue(input('event-3'));

  const firstAttempt = [];
  await assert.rejects(
    queue.replay(async (event) => {
      firstAttempt.push(event.sequence);
      if (event.sequence === 2) throw new Error('offline');
      return true;
    }),
    /offline/,
  );
  assert.deepEqual(firstAttempt, [1, 2]);
  assert.deepEqual(queue.snapshot().events.map(({ sequence }) => sequence), [2, 3]);

  const secondAttempt = [];
  assert.equal(
    await queue.replay(async (event) => {
      secondAttempt.push(event.sequence);
      return true;
    }),
    2,
  );
  assert.deepEqual(secondAttempt, [2, 3]);
  assert.deepEqual(queue.snapshot(), { nextSequence: 4, events: [] });
});
