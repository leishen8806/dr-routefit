import test from 'node:test';
import assert from 'node:assert/strict';

import {
  adminFeaturePages,
  createAdminFeatureState,
  hasActionAttribute,
  renderAdminFeaturePage,
  requiresConfirmation,
} from './index.mjs';

test('exposes the five Frontend2 admin pages with demo-only actions', () => {
  assert.deepEqual(adminFeaturePages.map((page) => page.id), ['funds', 'price', 'marketing', 'api', 'settings']);
  for (const page of adminFeaturePages) assert.match(renderAdminFeaturePage(page.id), /示例|纯前端/);
});

test('keeps finance workflows in six tabs and confirms irreversible actions', () => {
  const state = createAdminFeatureState();
  assert.equal(state.funds.tabs.length, 6);
  assert.equal(requiresConfirmation('confirm-payout'), true);
  assert.equal(requiresConfirmation('disable-api-key'), true);
  assert.equal(requiresConfirmation('save-price-rule'), false);
});

test('renders configured finance, marketing and settings details without real secrets', () => {
  const state = createAdminFeatureState();
  state.funds.active = '司机提现';
  assert.match(renderAdminFeaturePage('funds', state), /运营先审批，财务再确认出款/);
  assert.match(renderAdminFeaturePage('marketing'), /核销规则/);
  assert.match(renderAdminFeaturePage('settings'), /减少动态效果/);
  assert.doesNotMatch(renderAdminFeaturePage('api'), /sk_live|password/i);
});

test('marks payout confirmation as an irreversible demo action', () => {
  const state = createAdminFeatureState();
  state.funds.active = '司机提现';
  assert.match(renderAdminFeaturePage('funds', state), /data-confirm="confirm-payout"/);
  state.dialog = '确认出款？此示例操作不可撤回。';
  assert.match(renderAdminFeaturePage('funds', state), /role="dialog"/);
});

test('recognizes an empty data action attribute so dialog controls remain usable', () => {
  assert.equal(hasActionAttribute({ hasAttribute: (name) => name === 'data-close-dialog' }, 'data-close-dialog'), true);
  assert.equal(hasActionAttribute({ hasAttribute: () => false }, 'data-close-dialog'), false);
});
