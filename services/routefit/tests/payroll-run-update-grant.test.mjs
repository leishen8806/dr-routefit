import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = new URL('../db/migrations/077_payroll.sql', import.meta.url);

test('runtime role cannot receive UPDATE on payroll.run before an update guard exists', async () => {
  const sql = await readFile(migration, 'utf8');
  assert.doesNotMatch(sql, /GRANT\s+UPDATE\s+ON\s+payroll\.run\s+TO\s+routefit_api/i);
  assert.match(sql, /GRANT\s+SELECT\s*,\s*INSERT\s+ON\s+payroll\.plan_version\s*,\s*payroll\.run\s*,\s*payroll\.run_line\s+TO\s+routefit_api/i);
});
