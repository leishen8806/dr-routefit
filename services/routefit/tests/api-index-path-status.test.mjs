import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const index = readFileSync(new URL('../../../contracts/rf-ux-v1-r2-api-index.md', import.meta.url), 'utf8');

test('Backend2 inventory marks all concrete paths as defined', () => {
  const rows = index.split('\n').filter(line => line.startsWith('| `') && line.includes('| Backend2 |'));
  assert.equal(rows.length, 16);
  assert.ok(rows.every(line => line.endsWith(`| ${'\u5df2\u5b9a\u4e49'} |`)), rows.join('\n'));
});
