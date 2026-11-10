import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const surfaceSource = await readFile(new URL('./FulfillmentSurface.tsx', import.meta.url), 'utf8');

test('uses shared design tokens for the driver fulfillment surface', () => {
  assert.match(surfaceSource, /import \{ [^}]*designTokens[^}]*nativeDialogA11yProps[^}]*nativeToastA11yProps[^}]* \} from '@routefit\/shared';/);
  assert.match(surfaceSource, /backgroundColor: designTokens\.color\.surface/);
  assert.match(surfaceSource, /borderRadius: designTokens\.radius\.large/);
  assert.match(surfaceSource, /fontSize: designTokens\.type\.size\.lead/);
  assert.match(surfaceSource, /backgroundColor: designTokens\.color\.navy/);
  assert.match(surfaceSource, /borderColor: designTokens\.color\.line/);
  assert.match(surfaceSource, /backgroundColor: designTokens\.color\.scrim/);
  assert.doesNotMatch(surfaceSource, /#[0-9a-fA-F]{3,8}|rgba?\(/);
  assert.match(surfaceSource, /if \(result\.record && collection\?\.canRecord && !recorded\)/);
  assert.match(surfaceSource, /collectionConfirmationState\(method, confirmed, recorded\)/);
  assert.match(surfaceSource, /t\('deliveryVerificationExample'\)/);
  assert.match(surfaceSource, /t\('loadScan'\)/);
  assert.match(surfaceSource, /t\('undeliveredReason'\)/);
  assert.match(surfaceSource, /t\('problemReport'\)/);
  assert.match(surfaceSource, /offlineNotice\(offline\)/);
});
