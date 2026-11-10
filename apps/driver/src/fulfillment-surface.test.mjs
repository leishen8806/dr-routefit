import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('keeps the fulfillment controls in an independently mountable surface', async () => {
  const source = await readFile(new URL('./FulfillmentSurface.tsx', import.meta.url), 'utf8');

  assert.match(source, /export function FulfillmentSurface/);
  assert.match(source, /t\('loadScan'\)/);
  assert.match(source, /t\('undeliveredReason'\)/);
  assert.match(source, /t\('problemReport'\)/);
  assert.match(source, /t\('collectionExampleOnly'\)/);
});
