export type AuthHeaders = Record<string, string>;

export interface DriverAuth {
  headers(): AuthHeaders;
}

export function developmentSessionAuth(token: string): DriverAuth {
  const value = token.trim();
  if (value.length < 32 || value.length > 512) {
    throw new Error('请输入有效的本机开发会话令牌');
  }

  return {
    headers: () => ({ Cookie: `rf_session=${value}` }),
  };
}
