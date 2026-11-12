import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import test from 'node:test';

import { adminNavigation } from '../src/navigation.mjs';

const routeFileFor = (href) => new URL(`../app/${href === '/' ? 'index' : href.slice(1)}.tsx`, import.meta.url);

test('every admin navigation href has an Expo Router route file', async () => {
  await Promise.all(adminNavigation.map(async ({ href }) => {
    await access(routeFileFor(href));
  }));

  assert.equal(adminNavigation.length, 12);
});
