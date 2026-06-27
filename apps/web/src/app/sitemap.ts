import { MetadataRoute } from 'next';
import { getApiBaseForServer, getSiteUrl } from '@/lib/siteUrls';

const API_BASE = getApiBaseForServer();

async function fetchBlogSlugs(): Promise<string[]> {
  try {
    const res = await fetch(`${API_BASE}/blog/posts?limit=500`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    const posts = json?.data?.posts ?? [];
    if (!Array.isArray(posts)) return [];
    return posts
      .map((p: { slug?: string }) => p.slug)
      .filter((s): s is string => Boolean(s));
  } catch {
    return [];
  }
}

async function fetchBlogCategorySlugs(): Promise<string[]> {
  try {
    const res = await fetch(`${API_BASE}/blog/categories`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    const categories = json?.data ?? [];
    if (!Array.isArray(categories)) return [];
    return categories
      .map((c: { slug?: string }) => c.slug)
      .filter((s): s is string => Boolean(s));
  } catch {
    return [];
  }
}

async function fetchSlugs(endpoint: string, field: string): Promise<string[]> {
  try {
    const res = await fetch(`${API_BASE}/${endpoint}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    const items = json?.data?.data ?? json?.data?.products ?? json?.data?.items ?? json?.data ?? [];
    if (!Array.isArray(items)) return [];
    return items
      .map((item: { [key: string]: string }) => item[field])
      .filter(Boolean)
      .slice(0, 500);
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteUrl();

  const landingPages: Array<{ path: string; priority: number; changeFrequency: 'daily' | 'weekly' }> = [
    { path: '', priority: 1, changeFrequency: 'daily' },
    { path: '/universes', priority: 0.85, changeFrequency: 'weekly' },
    { path: '/the-experience', priority: 0.85, changeFrequency: 'weekly' },
    { path: '/founding-members', priority: 0.8, changeFrequency: 'weekly' },
  ];

  const storefrontPages = [
    '/shop',
    '/products',
    '/fandoms',
    '/blog',
    '/login',
    '/help',
    '/support/kb',
    '/shipping',
    '/returns',
    '/gift-cards/purchase',
    '/privacy-policy',
    '/do-not-sell',
    '/loyalty',
    '/sellers',
  ];

  const entries: MetadataRoute.Sitemap = [
    ...landingPages.map(({ path, priority, changeFrequency }) => ({
      url: `${baseUrl}${path}`,
      lastModified: new Date(),
      changeFrequency,
      priority,
    })),
    ...storefrontPages.map((path) => ({
      url: `${baseUrl}${path}`,
      lastModified: new Date(),
      changeFrequency: (path === '/shop' ? 'daily' : 'weekly') as 'daily' | 'weekly',
      priority: path === '/shop' ? 0.9 : 0.8,
    })),
  ];

  const [productSlugs, sellerSlugs, blogSlugs, blogCategorySlugs] = await Promise.all([
    fetchSlugs('products?limit=500&status=ACTIVE', 'slug'),
    fetchSlugs('sellers?limit=200', 'slug'),
    fetchBlogSlugs(),
    fetchBlogCategorySlugs(),
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

  for (const slug of blogSlugs) {
    entries.push({
      url: `${baseUrl}/blog/${slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    });
  }

  for (const slug of blogCategorySlugs) {
    entries.push({
      url: `${baseUrl}/blog/category/${slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.65,
    });
  }

  return entries;
}
