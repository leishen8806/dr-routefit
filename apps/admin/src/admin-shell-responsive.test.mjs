import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('uses a CSS breakpoint so the admin shell has no hydration-time layout switch', async () => {
  const source = await readFile(new URL('./AdminShell.tsx', import.meta.url), 'utf8');

  assert.match(source, /@media \(max-width: 900px\)/);
  assert.doesNotMatch(source, /useWindowDimensions|Dimensions\.get/);
});
