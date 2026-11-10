export type Toast = { id: string; message: string };

export type ToastState = {
  active: Toast | null;
  queue: Toast[];
};

export function createToastState(): ToastState {
  return { active: null, queue: [] };
}

export function enqueueToast(state: ToastState, toast: Toast): ToastState {
  if (!state.active) return { active: toast, queue: state.queue };
  return { active: state.active, queue: [...state.queue, toast] };
}

export function dismissToast(state: ToastState): ToastState {
  const [next, ...queue] = state.queue;
  return { active: next ?? null, queue };
}

export function confirmationState(armed: boolean) {
  return armed
    ? { step: 'submit' as const, canSubmit: true }
    : { step: 'confirm' as const, canSubmit: false };
}

export function detailDrawerState<T>(record: T | null) {
  return { open: record !== null, record };
}

export function loadingState(reducedMotion: boolean) {
  return reducedMotion
    ? { animation: 'rf-calm' as const, durationMs: 1600 }
    : { animation: 'rf-write' as const, durationMs: 1800 };
}

export function adSlotState(visible: boolean) {
  return visible ? { visible: true, label: '广告' } : { visible: false, label: null };
}

export type FocusTarget = { focus: () => void };

export type DialogKeyEvent = {
  key: string;
  target?: FocusTarget;
  shiftKey?: boolean;
  preventDefault: () => void;
};

export type DialogControllerOptions = {
  titleId: string;
  descriptionId?: string;
  trigger?: FocusTarget;
  focusables?: FocusTarget[];
  container?: FocusTarget;
  onCancel?: () => void;
};

export type DialogController = {
  open: () => void;
  close: (reason?: 'cancel' | 'escape' | 'replaced') => void;
  isOpen: () => boolean;
  onKeyDown: (event: DialogKeyEvent) => boolean;
  readonly props: Record<string, string | boolean>;
};

export function toastA11yProps() {
  return { role: 'status', 'aria-live': 'polite' } as const;
}

export function nativeToastA11yProps() {
  return { accessibilityLiveRegion: 'polite' } as const;
}

export function nativeDialogA11yProps(label: string) {
  return {
    accessibilityLabel: label,
    accessibilityRole: 'alert',
    accessibilityViewIsModal: true,
  } as const;
}

export function drawerA11yProps(titleId: string, descriptionId?: string) {
  return dialogA11yProps(titleId, descriptionId);
}

function dialogA11yProps(titleId: string, descriptionId?: string) {
  return {
    role: 'dialog',
    'aria-modal': true,
    'aria-labelledby': titleId,
    ...(descriptionId ? { 'aria-describedby': descriptionId } : {}),
  } as const;
}

export function createDialogController(options: DialogControllerOptions): DialogController {
  let open = false;
  const focusables = options.focusables ?? [];
  const props = dialogA11yProps(options.titleId, options.descriptionId);

  function focusInitial() {
    (focusables[0] ?? options.container)?.focus();
  }

  function close(reason: 'cancel' | 'escape' | 'replaced' = 'cancel') {
    if (!open) return;
    open = false;
    if (reason === 'cancel' || reason === 'escape') options.onCancel?.();
    options.trigger?.focus();
  }

  function onKeyDown(event: DialogKeyEvent) {
    if (!open) return false;
    if (event.key === 'Escape') {
      event.preventDefault();
      close('escape');
      return true;
    }
    if (event.key !== 'Tab' || focusables.length === 0) return false;

    const currentIndex = focusables.indexOf(event.target as FocusTarget);
    const boundaryIndex = event.shiftKey ? 0 : focusables.length - 1;
    if (currentIndex !== boundaryIndex) return false;

    event.preventDefault();
    (event.shiftKey ? focusables[focusables.length - 1] : focusables[0]).focus();
    return true;
  }

  return {
    open: () => {
      if (open) return;
      open = true;
      focusInitial();
    },
    close,
    isOpen: () => open,
    onKeyDown,
    props,
  };
}

export function createOverlayManager() {
  let activeDialog: DialogController | null = null;
  return {
    open(dialog: DialogController) {
      if (activeDialog && activeDialog !== dialog) activeDialog.close('replaced');
      activeDialog = dialog;
      dialog.open();
    },
    closeActive() {
      activeDialog?.close();
      activeDialog = null;
    },
  };
}
