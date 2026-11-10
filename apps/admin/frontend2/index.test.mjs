import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  adminFeaturePages,
  createAdminFeatureState,
  hasActionAttribute,
  mountAdminFeaturePages,
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

test('wires take-cash confirmation from driver cash rows into the confirmation dialog', () => {
  const root = {
    innerHTML: '',
    addEventListener(_type, listener) { this.listener = listener; },
  };
  const mounted = mountAdminFeaturePages(root);
  mounted.state.funds.active = '\u53f8\u673a\u73b0\u91d1';
  mounted.setPage('funds');
  assert.match(root.innerHTML, /data-confirm="take-cash"/);
  root.listener({ target: { closest: () => ({ dataset: { confirm: 'take-cash', detail: 'Sokha' } }) } });
  assert.match(root.innerHTML, /role="dialog"/);
});

test('falls back and escapes hostile admin page values before HTML rendering', () => {
  const hostile = '"><script>x</script>';
  const state = createAdminFeatureState();
  state.detail = hostile;
  state.dialog = hostile;
  const html = renderAdminFeaturePage(hostile, state);
  assert.match(html, /data-page="funds"/);
  assert.match(html, /data-create="funds"/);
  assert.doesNotMatch(html, /<script>x<\/script>/);
  assert.match(html, /&quot;&gt;&lt;script&gt;x&lt;\/script&gt;/);
});

test('recognizes an empty data action attribute so dialog controls remain usable', () => {
  assert.equal(hasActionAttribute({ hasAttribute: (name) => name === 'data-close-dialog' }, 'data-close-dialog'), true);
  assert.equal(hasActionAttribute({ hasAttribute: () => false }, 'data-close-dialog'), false);
});

test('keeps documented UI audit font weights and dark row actions accessible', () => {
  const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
  assert.match(styles, /\.rf2 h1[^}]*font-weight:600/);
  assert.match(styles, /\.rf2 b[^}]*font-weight:600/);
  assert.match(styles, /\.rf2-row em\s*\{\s*color:#67e8c4/);
});
