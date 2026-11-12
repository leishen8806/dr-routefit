import assert from 'node:assert/strict';
import { access, stat } from 'node:fs/promises';
import test from 'node:test';

const operationsRouteHrefs = ['/orders', '/capacity', '/customers', '/merchants'];
const frontend2RouteHrefs = ['/finance', '/pricing', '/marketing', '/integrations', '/settings'];
const routeFileFor = (href) => new URL(`../app/${href.slice(1)}.tsx`, import.meta.url);

test('every Frontend1 operations navigation href has an Expo Router route file', async () => {
  await Promise.all(operationsRouteHrefs.map(async (href) => {
    await access(routeFileFor(href));
  }));

  assert.equal(operationsRouteHrefs.length, 4);
});

test('Frontend2-owned navigation routes are not implemented by Frontend1', async () => {
  const results = await Promise.all(frontend2RouteHrefs.map(async (href) => {
    try {
      await stat(routeFileFor(href));
      return href;
    } catch (error) {
      assert.equal(error.code, 'ENOENT');
      return null;
    }
  }));

  assert.deepEqual(results, [null, null, null, null, null]);
});
