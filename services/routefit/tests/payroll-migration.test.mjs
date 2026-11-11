import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const migration = new URL('../db/migrations/077_payroll.sql', import.meta.url);

test('payroll migration version-controls example plans and preserves company-scoped payroll history', async () => {
  const sql = await readFile(migration, 'utf8');
  assert.match(sql, /^BEGIN;/);
  assert.match(sql, /COMMIT;\s*$/);
  assert.match(sql, /CREATE TABLE payroll\.plan_version/);
  assert.match(sql, /CREATE TABLE payroll\.run/);
  assert.match(sql, /CREATE TABLE payroll\.run_line/);
  assert.match(sql, /example_label text NOT NULL DEFAULT '示例'/);
  assert.match(sql, /deductions_enabled boolean NOT NULL DEFAULT false/);
  assert.match(sql, /CHECK\(NOT deductions_enabled OR \(state='approved' AND approved_by_principal_id IS NOT NULL\)\)/);
  assert.match(sql, /CHECK\(approved_by_principal_id IS NULL OR prepared_by_principal_id<>approved_by_principal_id\)/);
  assert.match(sql, /CREATE FUNCTION payroll\.require_approved_plan_version\(\)/);
  assert.match(sql, /CREATE TRIGGER payroll_run_requires_approved_plan/);
  assert.match(sql, /money_gross_minor bigint NOT NULL/);
  assert.match(sql, /money_deduction_minor bigint NOT NULL/);
  assert.match(sql, /CHECK\(money_deduction_minor<=money_gross_minor\)/);
  assert.match(sql, /plan_version_id uuid NOT NULL/);
  assert.match(sql, /CREATE TRIGGER payroll_plan_version_append_only/);
  assert.match(sql, /CREATE TRIGGER payroll_run_line_append_only/);
  for (const table of ['payroll.plan_version', 'payroll.run', 'payroll.run_line']) {
    assert.match(sql, new RegExp(`ALTER TABLE ${table.replace('.', '\\.')} ENABLE ROW LEVEL SECURITY`));
    assert.match(sql, new RegExp(`ALTER TABLE ${table.replace('.', '\\.')} FORCE ROW LEVEL SECURITY`));
    assert.match(sql, new RegExp(`CREATE POLICY company_scope ON ${table.replace('.', '\\.')} `));
  }
});
