import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const appPath = fileURLToPath(new URL('../App.tsx', import.meta.url));

test('development-only UI uses one __DEV__ gate for demo and manual credentials', async () => {
  const source = await readFile(appPath, 'utf8');

  assert.match(source, /const showDevelopmentControls = __DEV__;/);

  assert.match(
    source,
    /\{showDevelopmentControls \? \(\s*<View style=\{styles\.login\}>\s*<DriverDemoScreens/,
    'the demo panel must be behind the development gate',
  );
  assert.match(
    source,
    /\{showDevelopmentControls \? \(\s*<View style=\{styles\.login\}>\s*<Text style=\{styles\.label\}>\{t\('tokenLabel'\)\}<\/Text>[\s\S]*?\{t\('csrfLabel'\)\}/,
    'manual token and CSRF fields must be behind the same development gate',
  );
});
