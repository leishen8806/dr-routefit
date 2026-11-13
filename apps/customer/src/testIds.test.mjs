import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));
const homePageSource = fs.readFileSync(path.join(sourceDirectory, '../app/index.tsx'), 'utf8');

test('uses only available shared spacing tokens in the customer page', () => {
  assert.doesNotMatch(homePageSource, /designTokens\.space\.x5/);
});
