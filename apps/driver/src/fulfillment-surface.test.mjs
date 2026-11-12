import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('keeps the fulfillment controls in an independently mountable surface', async () => {
  const source = await readFile(new URL('./FulfillmentSurface.tsx', import.meta.url), 'utf8');

  assert.match(source, /export function FulfillmentSurface/);
  assert.match(source, /fulfillmentSurfacePlan\(stage, language\)/);
  assert.match(source, /const \{ status, panels \} = plan/);
  assert.match(source, /panels\.includes\('warehouse'\)/);
  assert.match(source, /panels\.includes\('load_scan'\)/);
  assert.match(source, /panels\.includes\('delivery_proof'\)/);
  assert.match(source, /createCollectionDialogSession/);
  assert.match(source, /collectionDialogSessionRef\.current\?\.onKeyDown/);
  assert.match(source, /onKeyDown=/);
  assert.match(source, /createOverlayManager/);
});

test('does not construct collection dialogs during render', async () => {
  const source = await readFile(new URL('./FulfillmentSurface.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /createDialogController\(/);
});

test('mounts the independent fulfillment surface from the trip detail', async () => {
  const source = await readFile(new URL('../App.tsx', import.meta.url), 'utf8');

  assert.match(source, /import \{ FulfillmentSurface \} from '\.\/src\/FulfillmentSurface';/);
  assert.match(source, /<FulfillmentSurface\s+language=\{language\}\s+stage=\{order\.order\.fulfillmentStage\}\s+offline=\{!online\}\s*\/>/);
});
