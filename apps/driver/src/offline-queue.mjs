function fingerprint(event) {
  return JSON.stringify(event);
}

function validate(events, nextSequence) {
  const ids = new Set();
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (event.sequence !== nextSequence + index) {
      throw new Error('Offline event sequence is not continuous');
    }
    if (ids.has(event.eventId)) {
      throw new Error('Offline eventId is duplicated');
    }
    ids.add(event.eventId);
  }
}

export function createOfflineEventQueue(snapshot = { nextSequence: 1, events: [] }) {
  let events = structuredClone(snapshot.events);
  let nextSequence = snapshot.nextSequence;
  validate(events, nextSequence);

  return {
    enqueue(input) {
      const existing = events.find((event) => event.eventId === input.eventId);
      if (existing) {
        if (fingerprint({ ...existing, sequence: undefined }) !== fingerprint({ ...input, sequence: undefined })) {
          throw new Error('Offline eventId conflicts with queued content');
        }
        return structuredClone(existing);
      }
      const event = { ...structuredClone(input), sequence: nextSequence + events.length };
      events.push(event);
      return structuredClone(event);
    },

    snapshot() {
      return { nextSequence, events: structuredClone(events) };
    },

    async replay(send) {
      let acknowledged = 0;
      while (events.length > 0) {
        const accepted = await send(structuredClone(events[0]));
        if (!accepted) break;
        events.shift();
        nextSequence += 1;
        acknowledged += 1;
      }
      return acknowledged;
    },
  };
}
