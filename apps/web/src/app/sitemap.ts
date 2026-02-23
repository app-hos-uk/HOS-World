import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://hos-marketplaceweb-production.up.railway.app';

  const staticPages = [
    '', '/products', '/login', '/help', '/support/kb',
    '/gift-cards/purchase', '/about',
  ];

  return staticPages.map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: path === '' ? 'daily' : 'weekly' as const,
    priority: path === '' ? 1 : 0.8,
  }));
}
