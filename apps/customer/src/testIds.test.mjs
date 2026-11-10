import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));
const homePageSource = fs.readFileSync(path.join(sourceDirectory, '../app/index.tsx'), 'utf8');

test('exposes the customer acceptance test IDs from the shared browser flow', () => {
  for (const testId of ['customer-ship-submit', 'customer-quote-confirm', 'customer-pay-confirm']) {
    assert.match(homePageSource, new RegExp(testId));
  }
});
