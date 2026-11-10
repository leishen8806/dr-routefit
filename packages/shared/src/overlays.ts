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
