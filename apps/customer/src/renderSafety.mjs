const SAFE_TEST_ID_SEGMENT = /^[a-z][a-z0-9-]*$/;

export function safeNavigationTarget(candidate, allowedHttpsHosts = []) {
  if (typeof candidate !== 'string' || candidate.length === 0) return null;
  if (/[\t\n\r]/.test(candidate)) return null;

  if (candidate.startsWith('/') && !candidate.startsWith('//') && !candidate.includes('\\')) {
    return candidate;
  }

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }

  const allowedHosts = new Set(allowedHttpsHosts.map((host) => host.toLowerCase()));
  if (parsed.protocol !== 'https:' || !allowedHosts.has(parsed.hostname.toLowerCase())) return null;

  return parsed.toString();
}

export function promotionNavigationTarget(promotion, allowedHttpsHosts = []) {
  if (!promotion || typeof promotion !== 'object' || Array.isArray(promotion)) return null;
  return safeNavigationTarget(promotion.target, allowedHttpsHosts);
}

export function indexedTestId(prefix, index) {
  if (!SAFE_TEST_ID_SEGMENT.test(prefix) || !Number.isSafeInteger(index) || index < 0) return null;
  return `${prefix}-${index}`;
}
