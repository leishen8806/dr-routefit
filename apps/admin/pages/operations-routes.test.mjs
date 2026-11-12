import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import test from 'node:test';

const operationsRouteHrefs = ['/orders', '/capacity', '/customers', '/merchants'];
const routeFileFor = (href) => new URL(`../app/${href.slice(1)}.tsx`, import.meta.url);

test('every Frontend1 operations navigation href has an Expo Router route file', async () => {
  await Promise.all(operationsRouteHrefs.map(async (href) => {
    await access(routeFileFor(href));
  }));

  assert.equal(operationsRouteHrefs.length, 4);
});
