import assert from 'node:assert/strict';
import test from 'node:test';

import { getOperationsPage, renderOperationsPage } from './operations-pages.mjs';

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

test('unknown pages return a safe not-found panel rather than rendering another business area', () => {
  assert.match(renderOperationsPage('billing'), /页面暂不可用/);
  assert.doesNotMatch(renderOperationsPage('billing'), /财务/);
});
