import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const index = new URL('../../../contracts/rf-ux-v1-r2-api-index.md', import.meta.url);

test('dashboard summary has one documented source and computation rule per demo metric', async () => {
  const content = await readFile(index, 'utf8');
  for (const field of [
    'pendingDispatchOrderCount', 'pendingDispatchOrderDeltaVsYesterday',
    'availableDriverCount', 'driversPendingConfirmationCount',
    'onTimeDeliveryRatePercent', 'onTimeDeliveryRateWindowDays',
    'actionRequiredExceptionCount'
  ]) assert.match(content, new RegExp('\\\\| \\`' + field + '\\`'), `missing lineage for ${field}`);
  assert.match(content, /orders\.draft/);
  assert.match(content, /casework\.dispatch_exception/);
  assert.match(content, /Backend2 070/);
});
