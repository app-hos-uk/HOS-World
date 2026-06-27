const DEV_SITE_URL = 'http://localhost:3000';

function trimUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

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

  const frontendUrl = process.env.FRONTEND_URL?.trim();
  if (frontendUrl) return trimUrl(frontendUrl);

  if (process.env.NODE_ENV === 'production') {
    console.warn(
      '[siteUrls] NEXT_PUBLIC_SITE_URL is not set in production; metadata may be incorrect.',
    );
  }

  return DEV_SITE_URL;
}
