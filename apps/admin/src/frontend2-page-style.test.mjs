import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('uses a light text token for the selected finance tab', async () => {
  const source = await readFile(new URL('./Frontend2Page.tsx', import.meta.url), 'utf8');

  assert.match(source, /activeTabText:\s*\{\s*color:\s*designTokens\.color\.surface/);
  assert.match(source, /activeTab === tab && styles\.activeTabText/);
});
