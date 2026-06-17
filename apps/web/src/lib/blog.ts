import { getDirectApiBaseUrl } from './apiBaseUrl';

const API_BASE = getDirectApiBaseUrl();

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  contentHtml: string;
  coverImage?: string | null;
  coverImageAlt?: string | null;
  coverImageTitle?: string | null;
  author: string;
  status: string;
  publishedAt?: string | null;
  updatedAt?: string | null;
  readingTime?: number | null;
  seoTitle?: string | null;
  metaDescription?: string | null;
  focusKeyword?: string | null;
  canonicalUrl?: string | null;
  category?: { id: string; name: string; slug: string } | null;
}

export interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  _count?: { posts: number };
}

async function blogFetch<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data ?? null;
  } catch {
    return null;
  }
}

export async function getPublishedPosts(params?: {
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const query = new URLSearchParams();
  if (params?.category) query.set('category', params.category);
  if (params?.search) query.set('search', params.search);
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return blogFetch<{ posts: BlogPost[]; total: number; page: number; totalPages: number }>(
    `/blog/posts${qs ? `?${qs}` : ''}`,
  );
}

export async function getPostBySlug(slug: string) {
  return blogFetch<{ post: BlogPost; related: BlogPost[] }>(`/blog/posts/${slug}`);
}

export async function getBlogCategories() {
  return blogFetch<BlogCategory[]>('/blog/categories');
}

export async function getCategoryBySlug(slug: string) {
  return blogFetch<{ category: BlogCategory; posts: { posts: BlogPost[]; total: number } }>(
    `/blog/categories/${slug}`,
  );
}

export async function getAllPublishedSlugs(): Promise<string[]> {
  const allSlugs: string[] = [];
  let page = 1;
  const batchSize = 50;
  while (true) {
    const data = await getPublishedPosts({ limit: batchSize, page });
    const slugs = data?.posts?.map((p) => p.slug).filter(Boolean) ?? [];
    allSlugs.push(...slugs);
    if (!data?.totalPages || page >= data.totalPages) break;
    page++;
  }
  return allSlugs;
}

export async function getAllCategorySlugs(): Promise<string[]> {
  const categories = await getBlogCategories();
  return categories?.map((c) => c.slug).filter(Boolean) ?? [];
}
