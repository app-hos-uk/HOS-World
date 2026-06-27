/**
 * CMS Integration Utilities for Next.js
 * Fetches content from Strapi CMS with ISR support
 */

export interface CMSPage {
  id: string;
  title: string;
  slug: string;
  content: string;
  seo?: {
    metaTitle?: string;
    metaDescription?: string;
    keywords?: string;
  };
  publishedAt?: string;
}

export interface CMSBanner {
  id: string;
  title: string;
  type: 'hero' | 'promotional' | 'sidebar';
  image: string;
  link?: string;
  content?: string;
  active: boolean;
  displayOrder?: number;
}

export interface CMSBlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: any;
  coverImage?: string;
  author?: string;
  publishedAt?: string;
}

export interface CmsHeroSlide {
  id: number;
  title: string;
  subtitle: string;
  description?: string;
  image: string;
  link: string;
  buttonText: string;
  fandom?: string;
}

export interface CmsCarouselBanner {
  id: number;
  title: string;
  image: string;
  link: string;
  badge?: string;
}

export interface CmsFeatureBanner {
  id: string;
  title: string;
  description: string;
  image: string;
  link: string;
  buttonText: string;
}

const CMS_URL =
  process.env.NEXT_PUBLIC_CMS_URL ||
  (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:1337/api');

function getStrapiOrigin(cmsApiUrl: string): string {
  return cmsApiUrl.replace(/\/api\/?$/, '');
}

function normalizeStrapiEntity<T extends Record<string, unknown>>(
  entity: unknown,
): (T & { id: string }) | null {
  if (!entity || typeof entity !== 'object') return null;
  const record = entity as Record<string, unknown>;
  if (record.attributes && typeof record.attributes === 'object') {
    return { id: String(record.id), ...(record.attributes as T) };
  }
  return { id: String(record.id ?? ''), ...(record as T) };
}

function normalizeStrapiCollection<T extends Record<string, unknown>>(
  items: unknown,
): Array<T & { id: string }> {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => normalizeStrapiEntity<T>(item))
    .filter((item): item is T & { id: string } => item != null);
}

function resolveStrapiMediaUrl(media: unknown): string | undefined {
  if (!media || !CMS_URL) return undefined;
  if (typeof media === 'string') {
    const trimmed = media.trim();
    if (!trimmed) return undefined;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    if (trimmed.startsWith('/')) return `${getStrapiOrigin(CMS_URL)}${trimmed}`;
    return trimmed;
  }
  if (typeof media === 'object') {
    const obj = media as Record<string, unknown>;
    const nested = obj.data ?? media;
    const normalized = normalizeStrapiEntity<{ url?: string }>(nested);
    if (normalized?.url) return resolveStrapiMediaUrl(normalized.url);
  }
  return undefined;
}

function stripRichText(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeBanner(raw: Record<string, unknown>): CMSBanner | null {
  const type = raw.type;
  if (type !== 'hero' && type !== 'promotional' && type !== 'sidebar') return null;
  const image = resolveStrapiMediaUrl(raw.image);
  if (!image) return null;
  if (raw.active === false) return null;

  return {
    id: String(raw.id),
    title: String(raw.title ?? ''),
    type,
    image,
    link: typeof raw.link === 'string' ? raw.link : undefined,
    content: typeof raw.content === 'string' ? raw.content : undefined,
    active: raw.active !== false,
    displayOrder: typeof raw.displayOrder === 'number' ? raw.displayOrder : 0,
  };
}

function normalizePage(raw: Record<string, unknown>): CMSPage | null {
  if (!raw.slug || !raw.title) return null;
  const seoRaw = raw.seo;
  const seo =
    seoRaw && typeof seoRaw === 'object' && !Array.isArray(seoRaw)
      ? (seoRaw as CMSPage['seo'])
      : undefined;

  return {
    id: String(raw.id),
    title: String(raw.title),
    slug: String(raw.slug),
    content: typeof raw.content === 'string' ? raw.content : String(raw.content ?? ''),
    seo,
    publishedAt: typeof raw.publishedAt === 'string' ? raw.publishedAt : undefined,
  };
}

async function fetchFromCms(path: string, revalidateSeconds: number): Promise<Response | null> {
  if (!CMS_URL) return null;
  try {
    return await fetch(`${CMS_URL}${path}`, { next: { revalidate: revalidateSeconds } });
  } catch {
    return null;
  }
}

/**
 * Fetch a published CMS page by slug with caching
 */
export async function getCMSPage(slug: string): Promise<CMSPage | null> {
  const response = await fetchFromCms(
    `/pages?filters[slug][$eq]=${encodeURIComponent(slug)}&populate=*`,
    3600,
  );
  if (!response?.ok) return null;

  const data = await response.json();
  const page = normalizeStrapiCollection<Record<string, unknown>>(data.data)
    .map(normalizePage)
    .find((p) => p && p.publishedAt);

  return page ?? null;
}

/**
 * Fetch active published banners by type
 */
export async function getCMSBanners(type: 'hero' | 'promotional' | 'sidebar'): Promise<CMSBanner[]> {
  const params = new URLSearchParams();
  params.set('filters[type][$eq]', type);
  params.set('filters[active][$eq]', 'true');
  params.set('populate', '*');
  params.set('sort', 'displayOrder:asc');

  const response = await fetchFromCms(`/banners?${params.toString()}`, 3600);
  if (!response?.ok) return [];

  const data = await response.json();
  return normalizeStrapiCollection<Record<string, unknown>>(data.data)
    .map(normalizeBanner)
    .filter((b): b is CMSBanner => b != null)
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
}

function parseBannerNumericId(id: string, fallback: number): number {
  const parsed = Number(id);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function mapHeroSlides(banners: CMSBanner[]): CmsHeroSlide[] {
  return banners.map((banner, index) => {
    const description = stripRichText(banner.content);
    return {
      id: parseBannerNumericId(banner.id, index + 1),
      title: banner.title,
      subtitle: 'House of Spells',
      description: description || undefined,
      image: banner.image,
      link: banner.link || '/products',
      buttonText: 'Shop now',
    };
  });
}

export function mapCarouselBanners(banners: CMSBanner[]): CmsCarouselBanner[] {
  return banners.map((banner, index) => ({
    id: parseBannerNumericId(banner.id, index + 1),
    title: banner.title,
    image: banner.image,
    link: banner.link || '/products',
    badge: banner.type === 'promotional' ? 'Promo' : undefined,
  }));
}

export function mapFeatureBanners(banners: CMSBanner[]): CmsFeatureBanner[] {
  return banners.map((banner) => ({
    id: banner.id,
    title: banner.title,
    description: stripRichText(banner.content) || banner.title,
    image: banner.image,
    link: banner.link || '/products',
    buttonText: 'Learn more',
  }));
}

/**
 * Fetch blog posts
 */
export async function getCMSBlogPosts(limit: number = 10): Promise<CMSBlogPost[]> {
  const response = await fetchFromCms(
    `/blog-posts?pagination[limit]=${limit}&sort=publishedAt:desc&populate=*`,
    1800,
  );
  if (!response?.ok) return [];

  const data = await response.json();
  return normalizeStrapiCollection<Record<string, unknown>>(data.data).map((post) => ({
    id: String(post.id),
    title: String(post.title ?? ''),
    slug: String(post.slug ?? ''),
    excerpt: String(post.excerpt ?? ''),
    content: post.content,
    coverImage: resolveStrapiMediaUrl(post.coverImage),
    author: typeof post.author === 'string' ? post.author : undefined,
    publishedAt: typeof post.publishedAt === 'string' ? post.publishedAt : undefined,
  }));
}

/**
 * Revalidate CMS content (called via webhook)
 */
export async function revalidateCMSPath(path: string): Promise<void> {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
      || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000');
    if (!appUrl) return;
    await fetch(`${appUrl}/api/cms/revalidate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.CMS_REVALIDATE_SECRET || ''}`,
      },
      body: JSON.stringify({ path }),
    });
  } catch (error) {
    console.error('Error revalidating CMS path:', error);
  }
}
