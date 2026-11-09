import {
  ApiError,
  localizedHeaders,
  responseBody,
  serverErrorCode,
  serverErrorMessage,
} from '@routefit/shared';
import type { DriverAuth } from './development-auth';
import {
  actionErrorCode,
  createActionPlan,
  createEvidenceActionPlan,
  createIdempotencyKey,
  ORDER_READ_FAILED,
  TASK_ACTION_FAILED,
  TASK_READ_FAILED,
} from './task-actions.mjs';

const LOCAL_DEVELOPMENT_ORIGIN = 'http://127.0.0.1:4180';
const REQUEST_TIMEOUT_MS = 15_000;

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
  order: { id: string; orderNo: string; state: string; serviceLevel: string; version: number; fulfillmentStage: string };
  pickup: DriverLocation;
  delivery: DriverLocation;
  items: DriverOrderItem[];
}

export interface AssignmentDetail {
  assignment: DriverAssignment;
  etag: string;
}

export interface DriverCustodyTransfer {
  id: string;
  version: number;
  status: 'partially_signed';
  items: { itemId: string; packageIds: string[] }[];
  initiatedAt: string;
}

export interface DepartureReadiness {
  ready: boolean;
  reasons: string[];
}

export interface RecipientAuthorization {
  id: string;
  orderId: string;
  orderVersion: number;
  expiresAt: string;
  state: string;
}

export interface UploadTicket {
  id: string;
  version: number;
  uploadUrl: string;
  method: 'PUT';
  expiresAt: string;
}

export interface EvidenceFile {
  id: string;
  state: string;
  version: number;
}

export interface DeliveryRequest {
  deliveredPackageIds: string[];
  remainingPackageIds: string[];
  recipientAuthorizationId: string;
  observedAt: string;
  evidenceFileIds: string[];
  reason?: string;
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

export class DriverApiError extends ApiError {}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = REQUEST_TIMEOUT_MS,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetcher(input, { ...init, signal: controller.signal });
  } catch (cause) {
    if (controller.signal.aborted) throw new DriverApiError(503, 'REQUEST_TIMEOUT', null);
    throw cause;
  } finally {
    clearTimeout(timer);
  }
}

function readHeaders(auth: DriverAuth, language: DriverLanguage): Record<string, string> {
  return localizedHeaders(auth.readHeaders(), language);
}

export async function listAssignments(
  auth: DriverAuth,
  language: DriverLanguage,
): Promise<AssignmentPage> {
  const response = await fetchWithTimeout(`${LOCAL_DEVELOPMENT_ORIGIN}/api/driver/v1/assignments`, {
    headers: readHeaders(auth, language),
  });
  const value = await responseBody(response);
  if (!response.ok) {
    throw new DriverApiError(response.status, actionErrorCode(response.status, TASK_READ_FAILED), serverErrorMessage(value));
  }
  return value as AssignmentPage;
}

export async function getAssignment(
  auth: DriverAuth,
  language: DriverLanguage,
  assignmentId: string,
): Promise<AssignmentDetail> {
  const response = await fetchWithTimeout(
    `${LOCAL_DEVELOPMENT_ORIGIN}/api/driver/v1/assignments/${encodeURIComponent(assignmentId)}`,
    { headers: readHeaders(auth, language) },
  );
  const value = await responseBody(response);
  if (!response.ok) {
    throw new DriverApiError(response.status, actionErrorCode(response.status, TASK_READ_FAILED), serverErrorMessage(value));
  }
  const assignment = value as DriverAssignment;
  return { assignment, etag: response.headers.get('etag') ?? `"${assignment.version}"` };
}

export async function getDriverOrder(
  auth: DriverAuth,
  language: DriverLanguage,
  orderId: string,
): Promise<DriverOrderDetail> {
  const response = await fetchWithTimeout(
    `${LOCAL_DEVELOPMENT_ORIGIN}/api/driver/v1/orders/${encodeURIComponent(orderId)}`,
    { headers: readHeaders(auth, language) },
  );
  const value = await responseBody(response);
  if (!response.ok) {
    throw new DriverApiError(response.status, actionErrorCode(response.status, ORDER_READ_FAILED), serverErrorMessage(value));
  }
  return value as DriverOrderDetail;
}

export async function listCustodyTransfers(
  auth: DriverAuth,
  language: DriverLanguage,
  assignmentId: string,
): Promise<DriverCustodyTransfer[]> {
  const response = await fetchWithTimeout(
    `${LOCAL_DEVELOPMENT_ORIGIN}/api/driver/v1/assignments/${encodeURIComponent(assignmentId)}/custody-transfers`,
    { headers: readHeaders(auth, language) },
  );
  const value = await responseBody(response);
  if (!response.ok) {
    throw new DriverApiError(response.status, actionErrorCode(response.status, 'CUSTODY_READ_FAILED'), serverErrorMessage(value));
  }
  return (value as { items: DriverCustodyTransfer[] }).items;
}

export async function getDepartureReadiness(
  auth: DriverAuth,
  language: DriverLanguage,
  assignmentId: string,
): Promise<DepartureReadiness> {
  const response = await fetchWithTimeout(
    `${LOCAL_DEVELOPMENT_ORIGIN}/api/driver/v1/assignments/${encodeURIComponent(assignmentId)}/departure-readiness`,
    { headers: readHeaders(auth, language) },
  );
  const value = await responseBody(response);
  if (!response.ok) {
    throw new DriverApiError(response.status, actionErrorCode(response.status, 'DEPARTURE_READ_FAILED'), serverErrorMessage(value));
  }
  return value as DepartureReadiness;
}

async function postEvidenceAction(
  auth: DriverAuth,
  language: DriverLanguage,
  path: string,
  resource: { version: number },
  etag: string,
  reason: string,
  evidenceFileId: string,
): Promise<unknown> {
  const plan = createEvidenceActionPlan({ resource, etag, reason, evidenceFileId });
  const response = await fetchWithTimeout(`${LOCAL_DEVELOPMENT_ORIGIN}${path}`, {
    method: 'POST',
    headers: {
      ...auth.writeHeaders(),
      'Accept-Language': language,
      'Content-Type': 'application/json',
      'Idempotency-Key': plan.idempotencyKey,
      'If-Match': plan.ifMatch,
    },
    body: JSON.stringify(plan.body),
  });
  const value = await responseBody(response);
  if (!response.ok) {
    throw new DriverApiError(response.status, serverErrorCode(value) ?? actionErrorCode(response.status), serverErrorMessage(value));
  }
  return value;
}

export async function confirmCustodyTransfer(
  auth: DriverAuth,
  language: DriverLanguage,
  transfer: DriverCustodyTransfer,
  reason: string,
  evidenceFileId: string,
): Promise<void> {
  await postEvidenceAction(
    auth,
    language,
    `/api/driver/v1/custody-transfers/${encodeURIComponent(transfer.id)}/actions/confirm`,
    transfer,
    `"${transfer.version}"`,
    reason,
    evidenceFileId,
  );
}

export async function departAssignment(
  auth: DriverAuth,
  language: DriverLanguage,
  detail: AssignmentDetail,
  reason: string,
  evidenceFileId: string,
): Promise<DriverAssignment> {
  return await postEvidenceAction(
    auth,
    language,
    `/api/driver/v1/assignments/${encodeURIComponent(detail.assignment.id)}/actions/depart`,
    detail.assignment,
    detail.etag,
    reason,
    evidenceFileId,
  ) as DriverAssignment;
}

export async function actOnAssignment(
  auth: DriverAuth,
  language: DriverLanguage,
  detail: AssignmentDetail,
  action: DriverAction,
  reason = '',
): Promise<DriverAssignment> {
  const plan = createActionPlan({ action, assignment: detail.assignment, etag: detail.etag, reason });
  const response = await fetchWithTimeout(
    `${LOCAL_DEVELOPMENT_ORIGIN}/api/driver/v1/assignments/${encodeURIComponent(plan.assignmentId)}/actions/${plan.action}`,
    {
      method: 'POST',
      headers: {
        ...auth.writeHeaders(),
        'Accept-Language': language,
        'Content-Type': 'application/json',
        'Idempotency-Key': plan.idempotencyKey,
        'If-Match': plan.ifMatch,
      },
      body: JSON.stringify(plan.body),
    },
  );
  const value = await responseBody(response);
  if (!response.ok) {
    throw new DriverApiError(response.status, actionErrorCode(response.status, TASK_ACTION_FAILED), serverErrorMessage(value));
  }
  return value as DriverAssignment;
}

export async function syncDriverEvent(
  auth: DriverAuth,
  language: DriverLanguage,
  deviceId: string,
  event: DriverArrivedEvent,
): Promise<DriverSyncResult> {
  const response = await fetchWithTimeout(`${LOCAL_DEVELOPMENT_ORIGIN}/api/driver/v1/sync/events`, {
    method: 'POST',
    headers: {
      ...auth.writeHeaders(),
      'Accept-Language': language,
      'Content-Type': 'application/json',
      'Idempotency-Key': event.eventId,
    },
    body: JSON.stringify({ deviceId, events: [event] }),
  });
  const value = await responseBody(response);
  if (!response.ok) {
    throw new DriverApiError(response.status, 'SYNC_FAILED', serverErrorMessage(value));
  }
  const result = (value as { results?: DriverSyncResult[] }).results?.[0];
  if (!result || result.eventId !== event.eventId) {
    throw new DriverApiError(502, 'SYNC_RESULT_INVALID', null);
  }
  return result;
}

export async function getRecipientAuthorization(
  auth: DriverAuth,
  language: DriverLanguage,
  orderId: string,
): Promise<RecipientAuthorization | null> {
  const response = await fetchWithTimeout(
    `${LOCAL_DEVELOPMENT_ORIGIN}/api/driver/v1/orders/${encodeURIComponent(orderId)}/recipient-authorization`,
    { headers: readHeaders(auth, language) },
  );
  const value = await responseBody(response);
  if (response.status === 404) return null;
  if (!response.ok) throw new DriverApiError(response.status, serverErrorCode(value) ?? 'RECIPIENT_AUTHORIZATION_READ_FAILED', serverErrorMessage(value));
  return value as RecipientAuthorization;
}

export async function createDriverUpload(
  auth: DriverAuth,
  language: DriverLanguage,
  request: { purpose: 'HANDOVER' | 'DELIVERY'; resourceId: string; mimeType: 'image/jpeg' | 'image/png'; sizeBytes: number; sha256: string },
): Promise<UploadTicket> {
  const response = await fetchWithTimeout(`${LOCAL_DEVELOPMENT_ORIGIN}/api/driver/v1/uploads`, {
    method: 'POST',
    headers: {
      ...auth.writeHeaders(),
      'Accept-Language': language,
      'Content-Type': 'application/json',
      'Idempotency-Key': createIdempotencyKey(),
    },
    body: JSON.stringify({ ...request, resourceType: 'ORDER' }),
  });
  const value = await responseBody(response);
  if (!response.ok) throw new DriverApiError(response.status, serverErrorCode(value) ?? 'EVIDENCE_UPLOAD_CREATE_FAILED', serverErrorMessage(value));
  return value as UploadTicket;
}

export async function uploadDriverEvidence(ticket: UploadTicket, body: Blob): Promise<void> {
  const response = await fetchWithTimeout(ticket.uploadUrl, {
    method: ticket.method,
    headers: { 'Content-Type': body.type },
    body,
  });
  if (!response.ok) throw new DriverApiError(response.status, 'EVIDENCE_UPLOAD_FAILED', null);
}

export async function completeDriverUpload(
  auth: DriverAuth,
  language: DriverLanguage,
  ticket: UploadTicket,
): Promise<EvidenceFile> {
  const response = await fetchWithTimeout(
    `${LOCAL_DEVELOPMENT_ORIGIN}/api/driver/v1/uploads/${encodeURIComponent(ticket.id)}/actions/complete`,
    {
      method: 'POST',
      headers: {
        ...auth.writeHeaders(),
        'Accept-Language': language,
        'Content-Type': 'application/json',
        'Idempotency-Key': createIdempotencyKey(),
        'If-Match': `"${ticket.version + 1}"`,
      },
      body: '{}',
    },
  );
  const value = await responseBody(response);
  if (!response.ok) throw new DriverApiError(response.status, serverErrorCode(value) ?? 'EVIDENCE_UPLOAD_COMPLETE_FAILED', serverErrorMessage(value));
  return value as EvidenceFile;
}

export async function recordDriverDelivery(
  auth: DriverAuth,
  language: DriverLanguage,
  order: DriverOrderDetail['order'],
  request: DeliveryRequest,
): Promise<DriverOrderDetail['order']> {
  const response = await fetchWithTimeout(
    `${LOCAL_DEVELOPMENT_ORIGIN}/api/driver/v1/orders/${encodeURIComponent(order.id)}/delivery-records`,
    {
      method: 'POST',
      headers: {
        ...auth.writeHeaders(),
        'Accept-Language': language,
        'Content-Type': 'application/json',
        'Idempotency-Key': createIdempotencyKey(),
        'If-Match': `"${order.version}"`,
      },
      body: JSON.stringify(request),
    },
  );
  const value = await responseBody(response);
  if (!response.ok) throw new DriverApiError(response.status, serverErrorCode(value) ?? 'DELIVERY_RECORD_FAILED', serverErrorMessage(value));
  return value as DriverOrderDetail['order'];
}
