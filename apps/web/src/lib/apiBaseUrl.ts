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

export function getPublicApiBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;

  // Default to localhost in dev
  const fallback =
    process.env.NODE_ENV === 'production'
      ? 'https://hos-marketplaceapi-production.up.railway.app/api'
      : 'http://localhost:3001/api';

  const normalized = normalizeApiBaseUrl(envUrl || fallback);
  return normalized;
}

