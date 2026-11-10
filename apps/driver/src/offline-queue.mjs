function fingerprint(event) {
  return JSON.stringify(sortKeys(event));
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortKeys(value[key])]));
  }
  return value;
}

const emptySnapshot = () => ({ nextSequence: 1, events: [], retries: {}, quarantined: [] });

function normalize(snapshot) {
  const value = structuredClone(snapshot ?? emptySnapshot());
  value.retries ??= {};
  value.quarantined ??= [];
  return value;
}

function validate(snapshot) {
  const ids = new Set();
  for (let index = 0; index < snapshot.events.length; index += 1) {
    const event = snapshot.events[index];
    if (event.sequence !== snapshot.nextSequence + index) throw new Error('Offline event sequence is not continuous');
    if (ids.has(event.eventId)) throw new Error('Offline eventId is duplicated');
    ids.add(event.eventId);
  }
  for (const entry of snapshot.quarantined) {
    if (ids.has(entry.event.eventId)) throw new Error('Offline eventId is duplicated');
    ids.add(entry.event.eventId);
  }
}

function arrivedEvent(input, sequence) {
  if (input.type !== 'ARRIVED') throw new Error('Only ARRIVED may be queued offline');
  if (typeof input.eventId !== 'string' || typeof input.assignmentId !== 'string') throw new Error('Offline event identifiers are required');
  if (!Number.isInteger(input.assignmentVersion) || !Number.isInteger(input.planVersion)) throw new Error('Offline event versions are invalid');
  if (Number.isNaN(Date.parse(input.observedAt))) throw new Error('Offline event time is invalid');
  const { point, evidenceFileIds } = input.payload ?? {};
  if (!Number.isFinite(point?.lat) || !Number.isFinite(point?.lng)) throw new Error('Offline event point is invalid');
  if (!Array.isArray(evidenceFileIds) || evidenceFileIds.some((id) => typeof id !== 'string')) throw new Error('Offline event evidence is invalid');
  return {
    eventId: input.eventId,
    sequence,
    assignmentId: input.assignmentId,
    assignmentVersion: input.assignmentVersion,
    planVersion: input.planVersion,
    observedAt: input.observedAt,
    type: 'ARRIVED',
    payload: { point: { lat: point.lat, lng: point.lng }, evidenceFileIds: [...evidenceFileIds] },
  };
}

function isTemporary(error) {
  const status = Number(error?.status);
  return !Number.isFinite(status) || status === 429 || status >= 500;
}

const retryableResultCodes = new Set([
  'SYNC_DEVICE_NOT_AUTHORIZED',
  'SYNC_PROCESSING_FAILED',
  'SYNC_SEQUENCE_INVALID',
]);

export function createOfflineEventQueue(
  initialSnapshot = emptySnapshot(),
  { persist = async () => {}, now = () => Date.now(), baseDelayMs = 1000 } = {},
) {
  let snapshot = normalize(initialSnapshot);
  let mutation = Promise.resolve();
  validate(snapshot);

  /**
   * @template T
   * @param {() => Promise<T>} operation
   * @returns {Promise<T>}
   */
  function serialize(operation) {
    const result = mutation.then(operation);
    mutation = result.catch(() => {});
    return result;
  }

  async function commit(next) {
    validate(next);
    await persist(structuredClone(next));
    snapshot = next;
  }

  return {
    async enqueue(input) {
      return serialize(async () => {
        const existing = snapshot.events.find((event) => event.eventId === input.eventId)
          ?? snapshot.quarantined.find((entry) => entry.event.eventId === input.eventId)?.event;
        if (existing) {
          const candidate = arrivedEvent(input, existing.sequence);
          if (fingerprint(existing) !== fingerprint(candidate)) {
            throw new Error('Offline eventId conflicts with queued content');
          }
          return structuredClone(existing);
        }
        const event = arrivedEvent(input, snapshot.nextSequence + snapshot.events.length);
        await commit({ ...structuredClone(snapshot), events: [...snapshot.events, event] });
        return structuredClone(event);
      });
    },

    snapshot() {
      return structuredClone(snapshot);
    },

    async replay(send) {
      return serialize(async () => {
        let accepted = 0;
        let quarantined = 0;
        while (snapshot.events.length > 0) {
          const event = snapshot.events[0];
          const retry = snapshot.retries[event.eventId];
          const t = now();
          if (retry?.nextAttemptAt > t) {
            return {
              accepted,
              quarantined,
              delayed: true,
              retryAfterMs: retry.nextAttemptAt - t,
              ...(retry.errorCode === 'SYNC_SEQUENCE_INVALID' && retry.attempts >= 5
                ? { dispatchRequired: true }
                : {}),
            };
          }

          let result;
          try {
            result = await send(structuredClone(event));
          } catch (error) {
            if (!isTemporary(error)) throw error;
            const settledAt = now();
            const attempts = (retry?.attempts ?? 0) + 1;
            const next = structuredClone(snapshot);
            next.retries[event.eventId] = {
              attempts,
              errorCode: null,
              nextAttemptAt: settledAt + Math.min(baseDelayMs * (2 ** (attempts - 1)), 60000),
            };
            await commit(next);
            return { accepted, quarantined, delayed: true, retryAfterMs: next.retries[event.eventId].nextAttemptAt - settledAt };
          }

          if (result.eventId !== event.eventId) throw new Error('Sync result eventId does not match');
          if (result.result === 'REJECTED' && retryableResultCodes.has(result.errorCode)) {
            const settledAt = now();
            const attempts = result.errorCode === 'SYNC_SEQUENCE_INVALID' && retry?.errorCode !== result.errorCode
              ? 1
              : (retry?.attempts ?? 0) + 1;
            const next = structuredClone(snapshot);
            next.retries[event.eventId] = {
              attempts,
              errorCode: result.errorCode,
              nextAttemptAt: settledAt + Math.min(baseDelayMs * (2 ** (attempts - 1)), 60000),
            };
            await commit(next);
            return {
              accepted,
              quarantined,
              delayed: true,
              retryAfterMs: next.retries[event.eventId].nextAttemptAt - settledAt,
              ...(result.errorCode === 'SYNC_SEQUENCE_INVALID' && attempts >= 5
                ? { dispatchRequired: true }
                : {}),
            };
          }

          const next = structuredClone(snapshot);
          next.events.shift();
          next.nextSequence += 1;
          delete next.retries[event.eventId];
          if (result.result === 'APPLIED' || result.result === 'DUPLICATE') {
            accepted += 1;
          } else if (result.result === 'REJECTED' || result.result === 'NEEDS_REVIEW') {
            next.quarantined.push({ event, result: result.result, errorCode: result.errorCode ?? null });
            quarantined += 1;
          } else {
            throw new Error('Unknown sync result');
          }
          await commit(next);
        }
        return { accepted, quarantined, delayed: false, retryAfterMs: 0 };
      });
    },
  };
}

export async function openOfflineEventQueue(store, options = {}) {
  return createOfflineEventQueue(await store.load(), { ...options, persist: (value) => store.save(value) });
}
