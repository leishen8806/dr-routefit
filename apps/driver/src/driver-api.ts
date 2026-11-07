import type { DriverAuth } from './development-auth';
import {
  actionErrorMessage,
  createActionPlan,
  sendWithNetworkRetry,
} from './task-actions.mjs';

const LOCAL_DEVELOPMENT_ORIGIN = 'http://127.0.0.1:4180';

export type DriverLanguage = 'zh-Hans' | 'en' | 'km';
export type DriverAction = 'accept' | 'reject';

export interface DriverAssignment {
  id: string;
  version: number;
  orderId: string;
  vehicleId: string;
  driverId: string;
  state: string;
  expiresAt: string;
  planVersion: number;
}

export interface DriverLocation {
  address: string;
  contactName: string;
  phone: string;
  point: { lat: number; lng: number } | null;
  landmark?: string;
}

export interface DriverOrderItem {
  id: string;
  name: string;
  quantity: number;
}

export interface DriverOrderDetail {
  order: { id: string; orderNo: string; state: string; serviceLevel: string };
  pickup: DriverLocation;
  delivery: DriverLocation;
  items: DriverOrderItem[];
}

export interface AssignmentDetail {
  assignment: DriverAssignment;
  etag: string;
}

interface AssignmentPage {
  items: DriverAssignment[];
  nextCursor: string | null;
}

export class DriverApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

function message(value: unknown, fallback: string): string {
  if (
    value &&
    typeof value === 'object' &&
    'error' in value &&
    value.error &&
    typeof value.error === 'object' &&
    'message' in value.error &&
    typeof value.error.message === 'string'
  ) {
    return value.error.message;
  }
  return fallback;
}

async function body(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

function readHeaders(auth: DriverAuth, language: DriverLanguage): Record<string, string> {
  return { ...auth.readHeaders(), 'Accept-Language': language };
}

export async function listAssignments(
  auth: DriverAuth,
  language: DriverLanguage,
): Promise<AssignmentPage> {
  const response = await fetch(`${LOCAL_DEVELOPMENT_ORIGIN}/api/driver/v1/assignments`, {
    headers: readHeaders(auth, language),
  });
  const value = await body(response);
  if (!response.ok) throw new DriverApiError(response.status, message(value, '任务读取失败'));
  return value as AssignmentPage;
}

export async function getAssignment(
  auth: DriverAuth,
  language: DriverLanguage,
  assignmentId: string,
): Promise<AssignmentDetail> {
  const response = await fetch(
    `${LOCAL_DEVELOPMENT_ORIGIN}/api/driver/v1/assignments/${encodeURIComponent(assignmentId)}`,
    { headers: readHeaders(auth, language) },
  );
  const value = await body(response);
  if (!response.ok) {
    throw new DriverApiError(response.status, actionErrorMessage(response.status, message(value, '任务读取失败')));
  }
  const assignment = value as DriverAssignment;
  return { assignment, etag: response.headers.get('etag') ?? `"${assignment.version}"` };
}

export async function getDriverOrder(
  auth: DriverAuth,
  language: DriverLanguage,
  orderId: string,
): Promise<DriverOrderDetail> {
  const response = await fetch(
    `${LOCAL_DEVELOPMENT_ORIGIN}/api/driver/v1/orders/${encodeURIComponent(orderId)}`,
    { headers: readHeaders(auth, language) },
  );
  const value = await body(response);
  if (!response.ok) {
    throw new DriverApiError(response.status, actionErrorMessage(response.status, message(value, '订单读取失败')));
  }
  return value as DriverOrderDetail;
}

export async function actOnAssignment(
  auth: DriverAuth,
  language: DriverLanguage,
  assignment: DriverAssignment,
  action: DriverAction,
  reason = '',
): Promise<DriverAssignment> {
  const plan = createActionPlan({ action, assignment, reason });
  const response = await sendWithNetworkRetry(plan, (attempt: {
    action: DriverAction;
    assignmentId: string;
    body: unknown;
    idempotencyKey: string;
    ifMatch: string;
  }) =>
    fetch(
      `${LOCAL_DEVELOPMENT_ORIGIN}/api/driver/v1/assignments/${encodeURIComponent(attempt.assignmentId)}/actions/${attempt.action}`,
      {
        method: 'POST',
        headers: {
          ...auth.writeHeaders(),
          'Accept-Language': language,
          'Content-Type': 'application/json',
          'Idempotency-Key': attempt.idempotencyKey,
          'If-Match': attempt.ifMatch,
        },
        body: JSON.stringify(attempt.body),
      },
    ),
  );
  const value = await body(response);
  if (!response.ok) {
    throw new DriverApiError(response.status, actionErrorMessage(response.status, message(value, '任务操作失败')));
  }
  return value as DriverAssignment;
}
