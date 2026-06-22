const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337/api';

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
  try {
    const url = `${STRAPI_URL}${endpoint}`;
    const res = await fetch(url, {
      ...options,
      next: { revalidate: 60 },
    });
    
    if (!res.ok) {
      console.error(`Strapi fetch error: ${res.status} for ${endpoint}`);
      return null;
    }
    
    return await res.json();
  } catch (error) {
    console.error('Strapi fetch error:', error);
    return null;
  }
}

export async function getBlogPosts(params?: {
  page?: number;
  pageSize?: number;
  category?: string;
}): Promise<StrapiResponse<StrapiBlogPost[]> | null> {
  const searchParams = new URLSearchParams();
  searchParams.set('populate', '*');
  searchParams.set('sort', 'publishedAt:desc');
  searchParams.set('filters[publishedAt][$notNull]', 'true');
  
  if (params?.page) searchParams.set('pagination[page]', String(params.page));
  if (params?.pageSize) searchParams.set('pagination[pageSize]', String(params.pageSize));
  if (params?.category) searchParams.set('filters[category][slug][$eq]', params.category);
  
  return strapiFetch<StrapiResponse<StrapiBlogPost[]>>(`/blog-posts?${searchParams}`);
}

export async function getBlogPost(slug: string): Promise<StrapiResponse<StrapiBlogPost[]> | null> {
  const searchParams = new URLSearchParams();
  searchParams.set('populate', '*');
  searchParams.set('filters[slug][$eq]', slug);
  searchParams.set('filters[publishedAt][$notNull]', 'true');
  
  return strapiFetch<StrapiResponse<StrapiBlogPost[]>>(`/blog-posts?${searchParams}`);
}

export async function getBlogCategories(): Promise<StrapiResponse<StrapiBlogCategory[]> | null> {
  return strapiFetch<StrapiResponse<StrapiBlogCategory[]>>('/blog-categories?populate=*');
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
  return `${STRAPI_URL.replace('/api', '')}${url}`;
}

export async function getBanners(type?: 'hero' | 'promotional' | 'sidebar'): Promise<StrapiResponse<StrapiBanner[]> | null> {
  const searchParams = new URLSearchParams();
  searchParams.set('populate', 'image');
  searchParams.set('filters[active][$eq]', 'true');
  searchParams.set('filters[publishedAt][$notNull]', 'true');
  searchParams.set('sort', 'displayOrder:asc');
  if (type) searchParams.set('filters[type][$eq]', type);

  return strapiFetch<StrapiResponse<StrapiBanner[]>>(`/banners?${searchParams}`);
}
