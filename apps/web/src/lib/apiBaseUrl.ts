/**
 * Shared helper for building the API base URL used by the web app.
 *
 * Our Nest API uses URI versioning, so the correct base is typically:
 *   https://<host>/api/v1
 *
 * We accept a few common inputs and normalize them:
 * - https://host            -> https://host/api/v1
 * - https://host/api        -> https://host/api/v1
 * - https://host/api/v1     -> https://host/api/v1
 */
export function normalizeApiBaseUrl(raw: string | undefined): string {
  const v = (raw || '').trim();
  if (!v) return '';

  // If user provides domain-only, assume https + /api/v1
  if (!v.startsWith('http://') && !v.startsWith('https://')) {
    const out = `https://${v.replace(/\/+$/, '')}/api/v1`;
    return out;
  }

  const trimmed = v.replace(/\/+$/, '');

  // Already versioned
  if (trimmed.endsWith('/api/v1') || trimmed.includes('/api/v1/')) {
    return trimmed;
  }

  // If ends with /api, append /v1
  if (trimmed.endsWith('/api')) {
    const out = `${trimmed}/v1`;
    return out;
  }

  // If contains /api somewhere but not /api/v1, prefer appending /api/v1.
  // (Avoid trying to rewrite complex paths; keep it simple and predictable.)
  if (trimmed.includes('/api')) {
    // If someone passed https://host/api (handled above) or https://host/api/xxx,
    // keep it as-is to avoid breaking non-standard proxies.
    return trimmed;
  }

  // Base host only, add /api/v1
  const out = `${trimmed}/api/v1`;
  return out;
}

export function getPublicApiBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;

  // Default to localhost in dev
  const fallback =
    process.env.NODE_ENV === 'production'
      ? 'https://hos-marketplaceapi-production.up.railway.app/api/v1'
      : 'http://localhost:3001/api/v1';

  const normalized = normalizeApiBaseUrl(envUrl || fallback);
  return normalized;
}

