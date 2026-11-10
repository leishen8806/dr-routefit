import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getOperationsPage,
  getOperationsRecord,
  reduceOperationsDrawer,
  renderOperationsDetail,
  renderOperationsPage,
  renderOperationsScreen,
} from './operations-pages.mjs';

test('operations pages expose all Frontend1-owned admin areas', () => {
  assert.deepEqual(
    ['orders', 'capacity', 'support', 'merchants', 'users'],
    ['orders', 'capacity', 'support', 'merchants', 'users'].map((id) => getOperationsPage(id).id),
  );
});

test('order view renders an accessible sample-data table and marks actions as frontend-only', () => {
  const markup = renderOperationsPage('orders');

  assert.match(markup, /<h1[^>]*>订单<\/h1>/);
  assert.match(markup, /<table/);
  assert.match(markup, /示例/);
  assert.match(markup, /data-mode="frontend-only"/);
});

test('each list row exposes a frontend-only detail trigger with its own record index', () => {
  const markup = renderOperationsPage('orders');

  assert.match(markup, /data-action="open-detail" data-record-index="0"/);
  assert.match(markup, /data-action="open-detail" data-record-index="1"/);
});

test('unknown pages return a safe not-found panel rather than rendering another business area', () => {
  assert.match(renderOperationsPage('billing'), /页面暂不可用/);
  assert.doesNotMatch(renderOperationsPage('billing'), /财务/);
});

test('detail drawer keeps row context and labels its action as frontend-only', () => {
  const markup = renderOperationsDetail('support', 0);

  assert.match(markup, /role="dialog"/);
  assert.match(markup, /CS-082/);
  assert.match(markup, /data-mode="frontend-only"/);
});

test('detail drawer rejects a row outside the selected page instead of leaking a different record', () => {
  assert.match(renderOperationsDetail('orders', 9), /记录暂不可用/);
  assert.doesNotMatch(renderOperationsDetail('orders', 9), /CS-082/);
});

test('selected record keeps its page and field labels for a route-owned detail drawer', () => {
  assert.deepEqual(getOperationsRecord('support', 0), {
    pageId: 'support',
    title: '客服与异常',
    fields: [
      ['工单', 'CS-082'],
      ['关联订单', 'RF-240811-018'],
      ['类型', '配送延迟'],
      ['负责人', '待分配'],
      ['SLA', '示例：30 分钟'],
    ],
  });
});

test('selected record returns null when the requested page row does not exist', () => {
  assert.equal(getOperationsRecord('support', 3), null);
});

test('drawer state opens only for a valid record in its requested page', () => {
  assert.deepEqual(
    reduceOperationsDrawer(null, { type: 'open', pageId: 'support', index: 0 }),
    { pageId: 'support', index: 0 },
  );
  assert.equal(reduceOperationsDrawer(null, { type: 'open', pageId: 'orders', index: 9 }), null);
});

test('drawer state closes without retaining a previously selected record', () => {
  assert.equal(
    reduceOperationsDrawer({ pageId: 'support', index: 0 }, { type: 'close' }),
    null,
  );
});

test('screen renders a matching drawer but never leaks a drawer from another page', () => {
  assert.match(renderOperationsScreen('support', { pageId: 'support', index: 0 }), /CS-082/);
  assert.doesNotMatch(renderOperationsScreen('orders', { pageId: 'support', index: 0 }), /CS-082/);
});
