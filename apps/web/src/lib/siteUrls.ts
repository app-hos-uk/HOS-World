const DEV_SITE_URL = 'http://localhost:3000';
const DEV_API_HOST = 'http://localhost:3001';

function trimUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

/** Public site URL for metadata, sitemaps, and structured data. */
export function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return trimUrl(fromEnv);

  if (process.env.VERCEL_URL) {
    return `https://${trimUrl(process.env.VERCEL_URL)}`;
  }

  const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  if (railwayDomain) {
    return `https://${trimUrl(railwayDomain.replace(/^https?:\/\//, ''))}`;
  }

  // Other public URL env vars set on Railway / Docker (may be baked at build time)
  for (const key of [
    'NEXT_PUBLIC_FRONTEND_URL',
    'NEXT_PUBLIC_APP_URL',
    'FRONTEND_URL',
  ] as const) {
    const url = process.env[key]?.trim();
    if (url) return trimUrl(url);
  }

  if (process.env.NODE_ENV === 'production') {
    console.warn(
      '[siteUrls] NEXT_PUBLIC_SITE_URL is not set in production; metadata may be incorrect. ' +
        'Set NEXT_PUBLIC_SITE_URL to your public domain.',
    );
  }

  return DEV_SITE_URL;
}

/** API host without /api suffix — for server-side fetch. */
export function getApiHost(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (fromEnv) return trimUrl(fromEnv).replace(/\/api$/, '');
  return DEV_API_HOST;
}

/** API base URL including /api prefix — for server-side fetch. */
export function getApiBaseForServer(): string {
  const host = getApiHost();
  return host.endsWith('/api') ? host : `${host}/api`;
}
