import { createDialogController } from '@routefit/shared';

export function createCollectionDialogSession({ manager, titleId, trigger, focusables, container, onCancel }) {
  let activeDialog = null;

  function onShow() {
    activeDialog = createDialogController({
      titleId,
      trigger,
      focusables,
      container,
      onCancel,
    });
    manager.open(activeDialog);
  }

  function onKeyDown(event) {
    return activeDialog?.onKeyDown(event) ?? false;
  }

  return { onShow, onKeyDown };
}
