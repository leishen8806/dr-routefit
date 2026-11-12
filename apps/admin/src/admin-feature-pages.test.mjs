import assert from 'node:assert/strict';
import test from 'node:test';

import { adminFeaturePages, getAdminFeaturePage } from './admin-feature-pages.mjs';

test('maps only the five Frontend2 navigation routes to static demo pages', () => {
  assert.deepEqual(
    adminFeaturePages.map(({ route }) => route),
    ['finance', 'pricing', 'marketing', 'integrations', 'settings'],
  );
  assert.equal(getAdminFeaturePage('finance').title, '财务');
  assert.equal(getAdminFeaturePage('orders'), null);
});

test('marks finance data and irreversible actions as static examples', () => {
  const finance = getAdminFeaturePage('finance');

  assert.match(finance.description, /演示数据/);
  assert.match(finance.notice, /纯前端/);
  assert.ok(finance.tabs.some((tab) => tab.label === 'KHQR 到账'));
  assert.ok(finance.tabs.flatMap((tab) => tab.rows).some((row) => row.requiresConfirmation));
});

test('keeps every demo page free of real-service configuration', () => {
  for (const page of adminFeaturePages) {
    assert.equal(page.demoOnly, true);
    assert.equal(/api[_-]?key|secret|password/i.test(JSON.stringify(page)), false);
  }
});
