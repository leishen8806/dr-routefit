import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const appSource = await readFile(new URL('../App.tsx', import.meta.url), 'utf8');

test('uses shared design tokens for the driver fulfillment surface', () => {
  assert.match(appSource, /import \{ designTokens \} from '@routefit\/shared';/);
  assert.match(appSource, /backgroundColor: designTokens\.color\.background/);
  assert.match(appSource, /borderRadius: designTokens\.radius\.large/);
  assert.match(appSource, /fontSize: designTokens\.type\.size\.title/);
  assert.match(appSource, /backgroundColor: designTokens\.color\.navy/);
  assert.match(appSource, /borderTopColor: designTokens\.color\.line/);
  assert.match(appSource, /accessibilityLabel=\{t\('status'\)\}/);
  assert.match(appSource, /if \(result\.record && collection\?\.canRecord && !collectionOutcome\)/);
  assert.match(appSource, /disabled=\{!collection\.canRecord \|\| Boolean\(collectionOutcome\)\}/);
  assert.match(appSource, /\(!collection\.canRecord \|\| Boolean\(collectionOutcome\)\) && styles\.buttonDisabled/);
  assert.match(appSource, /collectionConfirmationState\(collectionMethod, collectionConfirmed, Boolean\(collectionOutcome\)\)/);
  assert.match(appSource, /order\?\.order\.fulfillmentStage \?\? 'none'/);
  assert.match(appSource, /t\('deliveryVerificationExample'\)/);
});
