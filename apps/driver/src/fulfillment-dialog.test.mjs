import assert from 'node:assert/strict';
import test from 'node:test';

import { createCollectionDialogSession } from './fulfillment-dialog.mjs';
import { createOverlayManager } from '@routefit/shared';

test('routes Tab and Shift+Tab through the dialog instance opened by onShow', () => {
  const focusLog = [];
  const trigger = { focus: () => focusLog.push('trigger') };
  const cancel = { focus: () => focusLog.push('cancel') };
  const confirm = { focus: () => focusLog.push('confirm') };
  const container = { focus: () => focusLog.push('container') };
  const session = createCollectionDialogSession({
    manager: createOverlayManager(),
    titleId: 'collection-title',
    trigger,
    focusables: [cancel, confirm],
    container,
  });

  session.onShow();
  assert.deepEqual(focusLog, ['cancel']);

  let tabPrevented = false;
  assert.equal(session.onKeyDown({ key: 'Tab', target: confirm, preventDefault: () => (tabPrevented = true) }), true);
  assert.equal(tabPrevented, true);
  assert.deepEqual(focusLog, ['cancel', 'cancel']);

  let shiftTabPrevented = false;
  assert.equal(session.onKeyDown({ key: 'Tab', shiftKey: true, target: cancel, preventDefault: () => (shiftTabPrevented = true) }), true);
  assert.equal(shiftTabPrevented, true);
  assert.deepEqual(focusLog, ['cancel', 'cancel', 'confirm']);
});
