import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('keeps Link asChild Pressable styles as a single object while retaining active navigation', async () => {
  const source = await readFile(new URL('./AdminShell.tsx', import.meta.url), 'utf8');
  const linkChildren = [...source.matchAll(/<Link asChild[\s\S]*?<\/Link>/g)].map(([match]) => match);

  assert.ok(linkChildren.length > 0, 'expected at least one Link asChild navigation item');
  for (const linkChild of linkChildren) {
    assert.match(linkChild, /<Pressable\b/, 'Link asChild must directly wrap a Pressable');
    assert.doesNotMatch(linkChild, /<Pressable\b[^>]*\bstyle=\{\[/, 'Link asChild Pressable must not receive an array style');
    assert.match(linkChild, /pathname === item\.href/, 'navigation item must still detect its active pathname');
    assert.match(linkChild, /styles\.itemActive/, 'navigation item must still apply its active style');
  }
});
