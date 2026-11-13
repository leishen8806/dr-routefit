import assert from 'node:assert/strict';
import test from 'node:test';

import { autoRoutingSummary, dashboardMetrics, deliveryAreaSummary } from './admin-content.mjs';

test('marks dashboard figures as local examples instead of live operations data', () => {
  assert.equal(dashboardMetrics.every((metric) => metric.isExample), true);
  assert.equal(dashboardMetrics.length, 4);
});

test('keeps automatic routing a reviewable proposal until a dispatcher confirms it', () => {
  assert.equal(autoRoutingSummary.status, '待人工确认');
  assert.equal(autoRoutingSummary.isExample, true);
});

test('makes delivery area changes a local example rather than a published rule', () => {
  assert.equal(deliveryAreaSummary.publishState, '未发布');
  assert.equal(deliveryAreaSummary.isExample, true);
});
