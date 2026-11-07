export const TASK_NOT_FOUND = '任务不存在或已不属于你';
export const TASK_CHANGED = '任务已变化';

export function createIdempotencyKey() {
  const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `driver-${Date.now().toString(36)}-${random}`;
}

export function createActionPlan({ action, assignment, reason = '', keyFactory = createIdempotencyKey }) {
  return {
    action,
    assignmentId: assignment.id,
    idempotencyKey: keyFactory(),
    ifMatch: `"${assignment.version}"`,
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

export function actionErrorMessage(status, fallback = '任务操作失败') {
  if (status === 404) return TASK_NOT_FOUND;
  if (status === 409 || status === 412) return TASK_CHANGED;
  return fallback;
}

export function rejectConfirmationStep(armed) {
  return armed ? 'submit' : 'confirm';
}
