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

test('BackendSenior interface inventory is backed by concrete paths and response schemas', async () => {
  const document = JSON.parse(await readFile(specification, 'utf8'));
  const operations = [
    'createOptimizationRun', 'listOptimizationRuns', 'getOptimizationRun', 'adoptOptimizationRun',
    'listPayoutApprovals', 'getPayoutApproval', 'approvePayoutApproval', 'rejectPayoutApproval', 'confirmPayoutPaid',
    'createWithdrawalPayoutApproval', 'createMerchantSettlementPayoutApproval',
    'listPaySchemes', 'createPayScheme', 'submitPayScheme', 'approvePayScheme', 'createPayrollRun',
    'listPayrollRuns', 'getPayrollRun', 'listPayrollLines', 'submitPayrollRun',
    'listKpiRuleVersions', 'createKpiRuleVersion', 'approveKpiRuleVersion', 'listKpiMonthlyResults',
    'getKpiMonthlyResult', 'createRewardPenalty', 'listKpiAppeals', 'createKpiAppeal', 'decideKpiAppeal'
  ];
  const found = Object.values(document.paths).flatMap(path => Object.values(path)).filter(Boolean);
  assert.equal(found.filter(operation => operations.includes(operation.operationId)).length, operations.length);
  for (const operation of found.filter(operation => operations.includes(operation.operationId))) {
    assert.ok(operation.responses['401']);
    assert.ok(operation.responses['403']);
    assert.ok(operation.responses['429']);
    for (const response of Object.values(operation.responses)) {
      const reference = response?.content?.['application/json']?.schema?.$ref;
      if (reference) assert.ok(document.components.schemas[reference.split('/').at(-1)], `missing ${reference}`);
    }
  }
});
