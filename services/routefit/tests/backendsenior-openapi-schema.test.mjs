import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validate} from '../adapters/contract.mjs';

const specification = new URL('../../../contracts/openapi.json', import.meta.url);

test('BackendSenior write schemas keep simulated payouts, versioning, and example configuration explicit', async () => {
  const document = JSON.parse(await readFile(specification, 'utf8'));
  const schemas = document.components.schemas;

  for (const name of [
    'OptimizationRunCreate', 'AdoptOptimization', 'PayoutDecision',
    'PayoutConfirmation', 'PayoutApprovalCreate', 'PaySchemeDraft',
    'VersionedDecision', 'PayrollRunCreate', 'KpiRuleDraft',
    'RewardPenaltyDraft', 'KpiAppealCreate', 'KpiAppealDecision'
  ]) assert.ok(schemas[name], `missing ${name}`);

  assert.doesNotThrow(() => validate('PayoutConfirmation', {
    version: 1,
    paymentMode: 'SIMULATED'
  }));
  assert.throws(
    () => validate('PayoutConfirmation', {version: 1, paymentMode: 'BANK'}),
    {code: 'VALIDATION_FAILED'}
  );
  assert.throws(
    () => validate('PaySchemeDraft', {example: false, currency: 'USD'}),
    {code: 'VALIDATION_FAILED'}
  );
});
