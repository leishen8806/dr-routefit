import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const migration = new URL('../db/migrations/079_route_optimization.sql', import.meta.url);

test('route optimization migration stores company-scoped runs, routes and immutable events', async () => {
  const sql = await readFile(migration, 'utf8');
  assert.match(sql, /^BEGIN;/);
  assert.match(sql, /COMMIT;\s*$/);
  assert.match(sql, /CREATE TABLE dispatch\.optimization_run/);
  assert.match(sql, /CREATE TABLE dispatch\.optimization_route/);
  assert.match(sql, /CREATE TABLE dispatch\.optimization_run_event/);
  assert.match(sql, /idempotency_key text NOT NULL/);
  assert.match(sql, /version bigint NOT NULL CHECK\(version>=1\)/);
  assert.match(sql, /CREATE TRIGGER optimization_run_transition/);
  assert.match(sql, /CREATE TRIGGER optimization_route_append_only/);
  assert.match(sql, /CREATE TRIGGER optimization_run_event_append_only/);
  for (const table of ['dispatch.optimization_run', 'dispatch.optimization_route', 'dispatch.optimization_run_event']) {
    const name = table.replace('.', '\\.');
    assert.match(sql, new RegExp(`ALTER TABLE ${name} ENABLE ROW LEVEL SECURITY`));
    assert.match(sql, new RegExp(`ALTER TABLE ${name} FORCE ROW LEVEL SECURITY`));
    assert.match(sql, new RegExp(`CREATE POLICY company_scope ON ${name} `));
  }
});
