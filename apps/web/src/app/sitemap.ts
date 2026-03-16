import { MetadataRoute } from 'next';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  'https://hos-marketplaceapi-production.up.railway.app';

async function fetchSlugs(endpoint: string, field: string): Promise<string[]> {
  try {
    const res = await fetch(`${API_BASE}/api/${endpoint}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    const items = json?.data?.data ?? json?.data?.products ?? json?.data?.items ?? json?.data ?? [];
    if (!Array.isArray(items)) return [];
    return items
      .map((item: any) => item[field])
      .filter(Boolean)
      .slice(0, 500);
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://hos-marketplaceweb-production.up.railway.app';

  const staticPages = [
    '', '/products', '/login', '/help', '/support/kb',
    '/gift-cards/purchase', '/about', '/privacy-policy', '/do-not-sell',
  ];

  const entries: MetadataRoute.Sitemap = staticPages.map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: (path === '' ? 'daily' : 'weekly') as 'daily' | 'weekly',
    priority: path === '' ? 1 : 0.8,
  }));

  const [productSlugs, sellerSlugs] = await Promise.all([
    fetchSlugs('products?limit=500&status=ACTIVE', 'slug'),
    fetchSlugs('sellers?limit=200', 'slug'),
  ]);

  for (const slug of productSlugs) {
    entries.push({
      url: `${baseUrl}/products/${slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    });
  }

  for (const slug of sellerSlugs) {
    entries.push({
      url: `${baseUrl}/sellers/${slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    });
  }

  return entries;
}
