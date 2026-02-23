/**
 * CMS Integration Utilities for Next.js
 * Fetches content from Strapi CMS with ISR support
 */

export interface CMSPage {
  id: string;
  title: string;
  slug: string;
  content: any;
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

const CMS_URL = process.env.NEXT_PUBLIC_CMS_URL
  || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:1337/api');

/**
 * Fetch a CMS page by slug with caching
 */
export async function getCMSPage(slug: string): Promise<CMSPage | null> {
  try {
    // Use Next.js fetch with revalidation for ISR
    const response = await fetch(`${CMS_URL}/pages?filters[slug][$eq]=${slug}&populate=*`, {
      next: { revalidate: 3600 }, // Revalidate every hour
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    return data.data?.[0] || null;
  } catch (error) {
    console.error('Error fetching CMS page:', error);
    return null;
  }
}

/**
 * Fetch banners by type
 */
export async function getCMSBanners(type: 'hero' | 'promotional' | 'sidebar'): Promise<CMSBanner[]> {
  try {
    const response = await fetch(
      `${CMS_URL}/banners?filters[type][$eq]=${type}&filters[active][$eq]=true&populate=*`,
      {
        next: { revalidate: 3600 },
      }
    );
    
    if (!response.ok) {
      return [];
    }
    
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching CMS banners:', error);
    return [];
  }
}

/**
 * Fetch blog posts
 */
export async function getCMSBlogPosts(limit: number = 10): Promise<CMSBlogPost[]> {
  try {
    const response = await fetch(
      `${CMS_URL}/blog-posts?pagination[limit]=${limit}&sort=publishedAt:desc&populate=*`,
      {
        next: { revalidate: 1800 }, // Revalidate every 30 minutes
      }
    );
    
    if (!response.ok) {
      return [];
    }
    
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching CMS blog posts:', error);
    return [];
  }
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
        'Authorization': `Bearer ${process.env.CMS_REVALIDATE_SECRET || ''}`,
      },
      body: JSON.stringify({ path }),
    });
  } catch (error) {
    console.error('Error revalidating CMS path:', error);
  }
}

