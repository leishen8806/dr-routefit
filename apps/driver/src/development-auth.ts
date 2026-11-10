import type { RequestAuth } from '@routefit/shared';

export type DriverAuth = RequestAuth;

const LOCAL_DEVELOPMENT_ORIGIN = 'http://127.0.0.1:4180';

export function developmentSessionAuth(token: string, csrfToken: string): DriverAuth {
  const value = token.trim();
  if (value.length < 32 || value.length > 512) {
    throw new Error('请输入有效的本机开发会话令牌');
  }
  const csrf = csrfToken.trim();
  if (csrf.length < 32 || csrf.length > 512) {
    throw new Error('请输入有效的本机开发 CSRF 令牌');
  }

  // shortcut: local development tokens live only in memory, delete after RF-PM-055 batch 5 ships formal sessions.
  return {
    readHeaders: () => ({ Cookie: `rf_session=${value}` }),
    writeHeaders: () => ({
      Cookie: `rf_session=${value}`,
      Origin: LOCAL_DEVELOPMENT_ORIGIN,
      'X-CSRF-Token': csrf,
    }),
  };
}
