export const TASK_NOT_FOUND = 'TASK_NOT_FOUND';
export const TASK_CHANGED = 'TASK_CHANGED';
export const TASK_READ_FAILED = 'TASK_READ_FAILED';
export const ORDER_READ_FAILED = 'ORDER_READ_FAILED';
export const TASK_ACTION_FAILED = 'TASK_ACTION_FAILED';

export function createIdempotencyKey() {
  const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `driver-${Date.now().toString(36)}-${random}`;
}

export function createActionPlan({ action, assignment, etag, reason = '', keyFactory = createIdempotencyKey }) {
  return {
    action,
    assignmentId: assignment.id,
    idempotencyKey: keyFactory(),
    ifMatch: etag || `"${assignment.version}"`,
    body: action === 'accept' ? { planVersion: assignment.planVersion } : { reason },
  };
}

export async function sendWithNetworkRetry(plan, send) {
  try {
    return await send(plan);
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    return send(plan);
  }
}

export function actionErrorCode(status, fallback = TASK_ACTION_FAILED) {
  if (status === 404) return TASK_NOT_FOUND;
  if (status === 409 || status === 412) return TASK_CHANGED;
  return fallback;
}

export function rejectConfirmationStep(armed) {
  return armed ? 'submit' : 'confirm';
}
