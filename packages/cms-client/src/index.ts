/**
 * CMS Client Package
 * Provides utilities to fetch content from Strapi CMS
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

class CMSClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.NEXT_PUBLIC_CMS_URL || 'http://localhost:1337/api';
  }

  async fetchPage(slug: string): Promise<CMSPage | null> {
    try {
      const response = await fetch(`${this.baseUrl}/pages?filters[slug][$eq]=${slug}&populate=*`);
      const data = await response.json();
      return data.data?.[0] || null;
    } catch (error) {
      console.error('Error fetching CMS page:', error);
      return null;
    }
  }

  async fetchBanner(type: 'hero' | 'promotional' | 'sidebar'): Promise<CMSBanner[]> {
    try {
      const response = await fetch(`${this.baseUrl}/banners?filters[type][$eq]=${type}&filters[active][$eq]=true&populate=*`);
      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error fetching CMS banners:', error);
      return [];
    }
  }

  async fetchBlogPosts(limit: number = 10): Promise<CMSBlogPost[]> {
    try {
      const response = await fetch(`${this.baseUrl}/blog-posts?pagination[limit]=${limit}&sort=publishedAt:desc&populate=*`);
      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error fetching CMS blog posts:', error);
      return [];
    }
  }

  async fetchBlogPost(slug: string): Promise<CMSBlogPost | null> {
    try {
      const response = await fetch(`${this.baseUrl}/blog-posts?filters[slug][$eq]=${slug}&populate=*`);
      const data = await response.json();
      return data.data?.[0] || null;
    } catch (error) {
      console.error('Error fetching CMS blog post:', error);
      return null;
    }
  }
}

export const cmsClient = new CMSClient();
export default CMSClient;


