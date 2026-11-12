export type AuthHeaders = Record<string, string>;

export interface RequestAuth {
  readHeaders(): AuthHeaders;
  writeHeaders(): AuthHeaders;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly serverMessage: string | null;

  constructor(
    status: number,
    code: string,
    serverMessage: string | null,
  ) {
    super(code);
    this.status = status;
    this.code = code;
    this.serverMessage = serverMessage;
  }
}

export async function responseBody(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

export function serverErrorMessage(value: unknown): string | null {
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

export function serverErrorCode(value: unknown): string | null {
  if (
    value &&
    typeof value === 'object' &&
    'error' in value &&
    value.error &&
    typeof value.error === 'object' &&
    'code' in value.error &&
    typeof value.error.code === 'string'
  ) {
    return value.error.code;
  }
  return null;
}

export function localizedHeaders(headers: AuthHeaders, language: string): AuthHeaders {
  return { ...headers, 'Accept-Language': language };
}
