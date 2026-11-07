import type { DriverAuth } from './development-auth';
import {
  actionErrorCode,
  createActionPlan,
  ORDER_READ_FAILED,
  sendWithNetworkRetry,
  TASK_ACTION_FAILED,
  TASK_READ_FAILED,
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
  packageIds: string[];
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

export interface DriverArrivedEvent {
  eventId: string;
  sequence: number;
  assignmentId: string;
  assignmentVersion: number;
  planVersion: number;
  observedAt: string;
  type: 'ARRIVED';
  payload: {
    point: { lat: number; lng: number };
    evidenceFileIds: string[];
  };
}

export interface DriverSyncResult {
  eventId: string;
  result: 'APPLIED' | 'DUPLICATE' | 'REJECTED' | 'NEEDS_REVIEW';
  resourceId: string | null;
  resourceVersion: number | null;
  errorCode: string | null;
}

export class DriverApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly serverMessage: string | null,
  ) {
    super(code);
  }
}

function serverMessage(value: unknown): string | null {
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
  return null;
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
  if (!response.ok) {
    throw new DriverApiError(response.status, actionErrorCode(response.status, TASK_READ_FAILED), serverMessage(value));
  }
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
    throw new DriverApiError(response.status, actionErrorCode(response.status, TASK_READ_FAILED), serverMessage(value));
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
    throw new DriverApiError(response.status, actionErrorCode(response.status, ORDER_READ_FAILED), serverMessage(value));
  }
  return value as DriverOrderDetail;
}

export async function actOnAssignment(
  auth: DriverAuth,
  language: DriverLanguage,
  detail: AssignmentDetail,
  action: DriverAction,
  reason = '',
): Promise<DriverAssignment> {
  const plan = createActionPlan({ action, assignment: detail.assignment, etag: detail.etag, reason });
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
    throw new DriverApiError(response.status, actionErrorCode(response.status, TASK_ACTION_FAILED), serverMessage(value));
  }
  return value as DriverAssignment;
}

export async function syncDriverEvent(
  auth: DriverAuth,
  language: DriverLanguage,
  deviceId: string,
  event: DriverArrivedEvent,
): Promise<DriverSyncResult> {
  const response = await fetch(`${LOCAL_DEVELOPMENT_ORIGIN}/api/driver/v1/sync/events`, {
    method: 'POST',
    headers: {
      ...auth.writeHeaders(),
      'Accept-Language': language,
      'Content-Type': 'application/json',
      'Idempotency-Key': event.eventId,
    },
    body: JSON.stringify({ deviceId, events: [event] }),
  });
  const value = await body(response);
  if (!response.ok) {
    throw new DriverApiError(response.status, 'SYNC_FAILED', serverMessage(value));
  }
  const result = (value as { results?: DriverSyncResult[] }).results?.[0];
  if (!result || result.eventId !== event.eventId) {
    throw new DriverApiError(502, 'SYNC_RESULT_INVALID', null);
  }
  return result;
}
