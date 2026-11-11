import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const migration = new URL('../db/migrations/078_kpi_appeals.sql', import.meta.url);

test('KPI migration versions example configurations and keeps rewards and appeals append-only', async () => {
  const sql = await readFile(migration, 'utf8');
  assert.match(sql, /^BEGIN;/);
  assert.match(sql, /COMMIT;\s*$/);
  assert.match(sql, /CREATE TABLE kpi\.definition_version/);
  assert.match(sql, /CREATE TABLE kpi\.assessment/);
  assert.match(sql, /CREATE TABLE kpi\.reward_penalty/);
  assert.match(sql, /CREATE TABLE kpi\.appeal/);
  assert.match(sql, /example_label text NOT NULL DEFAULT '示例'/);
  assert.match(sql, /money_amount_minor bigint NOT NULL/);
  assert.match(sql, /definition_version_id uuid NOT NULL/);
  assert.match(sql, /CHECK\(decision_person_id IS NULL OR decision_person_id<>reward_penalty_author_person_id\)/);
  assert.match(sql, /CHECK\(approved_by_principal_id IS NULL OR prepared_by_principal_id<>approved_by_principal_id\)/);
  assert.match(sql, /SELECT assessment_id,author_person_id INTO penalty_assessment_id,actual_author_person_id FROM kpi\.reward_penalty/);
  assert.match(sql, /NEW\.reward_penalty_author_person_id<>actual_author_person_id/);
  assert.match(sql, /penalty_assessment_id<>NEW\.assessment_id/);
  assert.match(sql, /NEW\.state<>'submitted'/);
  assert.match(sql, /NEW\.decision_person_id=actual_author_person_id/);
  assert.match(sql, /CREATE TRIGGER kpi_definition_version_append_only/);
  assert.match(sql, /CREATE TRIGGER kpi_reward_penalty_append_only/);
  assert.match(sql, /CREATE TRIGGER kpi_appeal_transition/);
  for (const table of ['kpi.definition_version', 'kpi.assessment', 'kpi.reward_penalty', 'kpi.appeal']) {
    const name = table.replace('.', '\\.');
    assert.match(sql, new RegExp(`ALTER TABLE ${name} ENABLE ROW LEVEL SECURITY`));
    assert.match(sql, new RegExp(`ALTER TABLE ${name} FORCE ROW LEVEL SECURITY`));
    assert.match(sql, new RegExp(`CREATE POLICY company_scope ON ${name} `));
  }
});
