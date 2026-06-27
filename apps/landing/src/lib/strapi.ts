const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL || '';

function resolveInternalApiUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_API_URL || '').trim().replace(/\/+$/, '');
  if (!raw) return '';
  // If the URL already ends with /api, use as-is; otherwise append /api
  return raw.endsWith('/api') ? raw : `${raw}/api`;
}

const INTERNAL_API_URL = resolveInternalApiUrl();

export interface StrapiBlogPost {
  id: number;
  attributes: {
    title: string;
    slug: string;
    excerpt: string;
    content: string;
    author: string;
    readingTime?: number;
    seoTitle?: string;
    metaDescription?: string;
    publishedAt: string;
    createdAt: string;
    updatedAt: string;
    coverImage?: {
      data?: {
        attributes: {
          url: string;
          alternativeText?: string;
        };
      };
    };
    category?: {
      data?: {
        id: number;
        attributes: {
          name: string;
          slug: string;
        };
      };
    };
  };
}

export interface StrapiBlogCategory {
  id: number;
  attributes: {
    name: string;
    slug: string;
    description?: string;
  };
}

export interface StrapiResponse<T> {
  data: T;
  meta?: {
    pagination?: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
}

async function strapiFetch<T>(endpoint: string, options?: RequestInit): Promise<T | null> {
  if (!STRAPI_URL) return null;
  try {
    const url = `${STRAPI_URL}${endpoint}`;
    const res = await fetch(url, {
      ...options,
      next: { revalidate: 60 },
    });

    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Internal API fetcher (PostgreSQL blog system)
async function internalFetch<T>(path: string): Promise<T | null> {
  if (!INTERNAL_API_URL) return null;
  try {
    const res = await fetch(`${INTERNAL_API_URL}${path}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data ?? null;
  } catch {
    return null;
  }
}

// Adapt internal API blog posts to Strapi-like format for rendering
function adaptInternalPosts(
  data: { posts: any[]; total: number; page: number; totalPages: number } | null,
): StrapiResponse<StrapiBlogPost[]> | null {
  if (!data) return null;
  return {
    data: data.posts.map((p) => ({
      id: p.id,
      attributes: {
        title: p.title,
        slug: p.slug,
        excerpt: p.excerpt,
        content: p.contentHtml || p.content || '',
        author: p.author,
        readingTime: p.readingTime,
        seoTitle: p.seoTitle,
        metaDescription: p.metaDescription,
        publishedAt: p.publishedAt,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        coverImage: p.coverImage
          ? { data: { attributes: { url: p.coverImage, alternativeText: p.coverImageAlt } } }
          : undefined,
        category: p.category
          ? { data: { id: p.category.id, attributes: { name: p.category.name, slug: p.category.slug } } }
          : undefined,
      },
    })),
    meta: {
      pagination: {
        page: data.page,
        pageSize: data.posts.length,
        pageCount: data.totalPages,
        total: data.total,
      },
    },
  };
}

function adaptInternalCategories(
  cats: any[] | null,
): StrapiResponse<StrapiBlogCategory[]> | null {
  if (!cats) return null;
  return {
    data: cats.map((c) => ({
      id: c.id,
      attributes: { name: c.name, slug: c.slug, description: c.description },
    })),
  };
}

export async function getBlogPosts(params?: {
  page?: number;
  pageSize?: number;
  category?: string;
}): Promise<StrapiResponse<StrapiBlogPost[]> | null> {
  // Try Strapi first
  if (STRAPI_URL) {
    const searchParams = new URLSearchParams();
    searchParams.set('populate', '*');
    searchParams.set('sort', 'publishedAt:desc');
    searchParams.set('filters[publishedAt][$notNull]', 'true');
    if (params?.page) searchParams.set('pagination[page]', String(params.page));
    if (params?.pageSize) searchParams.set('pagination[pageSize]', String(params.pageSize));
    if (params?.category) searchParams.set('filters[category][slug][$eq]', params.category);

    const result = await strapiFetch<StrapiResponse<StrapiBlogPost[]>>(`/blog-posts?${searchParams}`);
    if (result) return result;
  }

  // Fallback: internal blog API
  const qs = new URLSearchParams();
  if (params?.category) qs.set('category', params.category);
  if (params?.page) qs.set('page', String(params.page));
  if (params?.pageSize) qs.set('limit', String(params.pageSize));
  const path = `/blog/posts${qs.toString() ? `?${qs}` : ''}`;
  const data = await internalFetch<{ posts: any[]; total: number; page: number; totalPages: number }>(path);
  return adaptInternalPosts(data);
}

export async function getBlogPost(slug: string): Promise<StrapiResponse<StrapiBlogPost[]> | null> {
  // Try Strapi first
  if (STRAPI_URL) {
    const searchParams = new URLSearchParams();
    searchParams.set('populate', '*');
    searchParams.set('filters[slug][$eq]', slug);
    searchParams.set('filters[publishedAt][$notNull]', 'true');
    const result = await strapiFetch<StrapiResponse<StrapiBlogPost[]>>(`/blog-posts?${searchParams}`);
    if (result) return result;
  }

  // Fallback: internal blog API
  const data = await internalFetch<{ post: any; related: any[] }>(`/blog/posts/${slug}`);
  if (!data?.post) return null;
  const p = data.post;
  return {
    data: [
      {
        id: p.id,
        attributes: {
          title: p.title,
          slug: p.slug,
          excerpt: p.excerpt,
          content: p.contentHtml || p.content || '',
          author: p.author,
          readingTime: p.readingTime,
          seoTitle: p.seoTitle,
          metaDescription: p.metaDescription,
          publishedAt: p.publishedAt,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          coverImage: p.coverImage
            ? { data: { attributes: { url: p.coverImage, alternativeText: p.coverImageAlt } } }
            : undefined,
          category: p.category
            ? { data: { id: p.category.id, attributes: { name: p.category.name, slug: p.category.slug } } }
            : undefined,
        },
      },
    ],
  };
}

export async function getBlogCategories(): Promise<StrapiResponse<StrapiBlogCategory[]> | null> {
  if (STRAPI_URL) {
    const result = await strapiFetch<StrapiResponse<StrapiBlogCategory[]>>('/blog-categories?populate=*');
    if (result) return result;
  }

  const cats = await internalFetch<any[]>('/blog/categories');
  return adaptInternalCategories(cats);
}

export interface StrapiBanner {
  id: number;
  attributes: {
    title: string;
    type: 'hero' | 'promotional' | 'sidebar';
    link?: string;
    content?: string;
    active: boolean;
    displayOrder: number;
    image?: {
      data?: {
        attributes: {
          url: string;
          alternativeText?: string;
        };
      };
    };
  };
}

export function getStrapiMediaUrl(url?: string): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  const base = STRAPI_URL ? STRAPI_URL.replace('/api', '') : '';
  return `${base}${url}`;
}

export async function getBanners(type?: 'hero' | 'promotional' | 'sidebar'): Promise<StrapiResponse<StrapiBanner[]> | null> {
  if (!STRAPI_URL) return null;
  const searchParams = new URLSearchParams();
  searchParams.set('populate', 'image');
  searchParams.set('filters[active][$eq]', 'true');
  searchParams.set('filters[publishedAt][$notNull]', 'true');
  searchParams.set('sort', 'displayOrder:asc');
  if (type) searchParams.set('filters[type][$eq]', type);

  return strapiFetch<StrapiResponse<StrapiBanner[]>>(`/banners?${searchParams}`);
}
