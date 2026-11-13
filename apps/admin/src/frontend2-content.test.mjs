import assert from 'node:assert/strict';
import test from 'node:test';

import {
  adminFeaturePages,
  financeTabs,
  normalizeFeaturePage,
  requiresConfirmation,
} from './frontend2-content.mjs';

test('keeps finance workflows in six tabs and confirms irreversible cash counting', () => {
  assert.equal(financeTabs.length, 6);
  assert.equal(requiresConfirmation('点钱确认'), 'take-cash');
});

test('keeps all Frontend2 pages local examples and masks displayed keys', () => {
  assert.deepEqual(adminFeaturePages.map((page) => page.id), ['finance', 'pricing', 'marketing', 'integrations', 'settings']);
  assert.equal(adminFeaturePages.every((page) => page.isExample), true);
  for (const page of adminFeaturePages.filter((item) => ['integrations', 'settings'].includes(item.id))) {
    assert.match(page.detail, /key_demo_••••（示例）/);
  }
});

test('falls back hostile or unknown page values to finance', () => {
  assert.equal(normalizeFeaturePage('pricing'), 'pricing');
  assert.equal(normalizeFeaturePage('finance\" onPress=\"x'), 'finance');
});
