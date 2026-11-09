import { openDatabaseAsync } from 'expo-sqlite';

const DATABASE_NAME = 'routefit-driver-offline.db';

export function createOfflineQueueStore() {
  const database = openDatabaseAsync(DATABASE_NAME);

  async function ready() {
    const db = await database;
    await db.execAsync('CREATE TABLE IF NOT EXISTS offline_queue_state (id INTEGER PRIMARY KEY CHECK (id = 1), snapshot_json TEXT NOT NULL)');
    return db;
  }

  return {
    async load(): Promise<unknown> {
      const db = await ready();
      const row = await db.getFirstAsync<{ snapshot_json: string }>(
        'SELECT snapshot_json FROM offline_queue_state WHERE id = 1',
      );
      return row ? JSON.parse(row.snapshot_json) : null;
    },

    async save(snapshot: unknown): Promise<void> {
      const db = await ready();
      const value = JSON.stringify(snapshot);
      await db.withExclusiveTransactionAsync(async (transaction) => {
        await transaction.runAsync(
          'INSERT INTO offline_queue_state(id, snapshot_json) VALUES(1, ?) ON CONFLICT(id) DO UPDATE SET snapshot_json = excluded.snapshot_json',
          value,
        );
      });
    },
  };
}
