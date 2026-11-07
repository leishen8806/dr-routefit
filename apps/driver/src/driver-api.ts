import type { DriverAuth } from './development-auth';

const LOCAL_DEVELOPMENT_ORIGIN = 'http://127.0.0.1:4180';

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

interface AssignmentPage {
  items: DriverAssignment[];
  nextCursor: string | null;
}

function message(value: unknown): string {
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
  return '任务读取失败';
}

export async function listAssignments(auth: DriverAuth): Promise<AssignmentPage> {
  const response = await fetch(`${LOCAL_DEVELOPMENT_ORIGIN}/api/driver/v1/assignments`, {
    headers: auth.headers(),
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(message(body));
  }
  return body as AssignmentPage;
}
