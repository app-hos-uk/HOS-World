/**
 * Shared helper for building the API base URL used by the web app.
 *
 * Our Nest API uses /api prefix (no versioning in URL).
 *
 * We accept a few common inputs and normalize them:
 * - https://host            -> https://host/api
 * - https://host/api        -> https://host/api
 * - https://host/api/v1     -> https://host/api (strip v1)
 */
export function normalizeApiBaseUrl(raw: string | undefined): string {
  const v = (raw || '').trim();
  if (!v) return '';

  // If user provides domain-only, assume https + /api
  if (!v.startsWith('http://') && !v.startsWith('https://')) {
    const out = `https://${v.replace(/\/+$/, '')}/api`;
    return out;
  }

  let trimmed = v.replace(/\/+$/, '');

  // Strip /v1 if present (legacy support)
  if (trimmed.endsWith('/api/v1')) {
    trimmed = trimmed.replace('/api/v1', '/api');
  }

  // If ends with /api, keep it
  if (trimmed.endsWith('/api')) {
    return trimmed;
  }

  // If contains /api somewhere, keep as-is
  if (trimmed.includes('/api')) {
    return trimmed;
  }

  // Base host only, add /api
  const out = `${trimmed}/api`;
  return out;
}

/**
 * Returns the direct (absolute) API URL — used for OAuth redirects (browser navigates
 * to the API domain) and server-side calls where cookies aren't relevant.
 */
export function getDirectApiBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl) {
    const normalized = normalizeApiBaseUrl(envUrl);
    if (normalized) return normalized;
  }
  return normalizeApiBaseUrl('http://localhost:3001/api') || 'http://localhost:3001/api';
}

/**
 * Returns the API base URL for fetch calls.
 * In production on the client, this returns the same-origin proxy path (`/api/proxy`)
 * so that auth cookies are first-party and not blocked by browsers with strict
 * third-party cookie policies (Chrome EU/UK, Safari ITP, Firefox ETP).
 */
export function getPublicApiBaseUrl(): string {
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
    return '/api/proxy';
  }
  return getDirectApiBaseUrl();
}

