import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * CMS Service -- proxies to Strapi headless CMS.
 * Manages pages, banners, and blog posts.
 */
@Injectable()
export class CmsService {
  private strapiUrl: string;
  private strapiToken: string | null;

  constructor(private configService: ConfigService) {
    this.strapiUrl = this.configService.get<string>('STRAPI_URL') || 'http://localhost:1337/api';
    this.strapiToken = this.configService.get<string>('STRAPI_API_TOKEN') || null;
  }

  private async strapiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...((options.headers as Record<string, string>) || {}) };
    if (this.strapiToken) headers['Authorization'] = `Bearer ${this.strapiToken}`;

    try {
      const response = await fetch(`${this.strapiUrl}${endpoint}`, { ...options, headers });
      if (!response.ok) throw new HttpException(`Strapi error: ${await response.text()}`, response.status);
      return await response.json();
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(`Strapi unavailable: ${error.message}`, HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  async getPages() { return (await this.strapiRequest<any>('/pages?populate=*')).data || []; }
  async getPage(id: string) { return (await this.strapiRequest<any>(`/pages/${id}?populate=*`)).data || null; }
  async createPage(data: any) { return (await this.strapiRequest<any>('/pages', { method: 'POST', body: JSON.stringify({ data }) })).data; }
  async updatePage(id: string, data: any) { return (await this.strapiRequest<any>(`/pages/${id}`, { method: 'PUT', body: JSON.stringify({ data }) })).data; }
  async deletePage(id: string) { await this.strapiRequest<any>(`/pages/${id}`, { method: 'DELETE' }); }

  async getBanners(type?: string) {
    const filter = type ? `?filters[type][$eq]=${type}&populate=*` : '?populate=*';
    return (await this.strapiRequest<any>(`/banners${filter}`)).data || [];
  }
  async createBanner(data: any) { return (await this.strapiRequest<any>('/banners', { method: 'POST', body: JSON.stringify({ data }) })).data; }

  async getBlogPosts(limit?: number) {
    const q = limit ? `?pagination[limit]=${limit}&populate=*` : '?populate=*';
    return (await this.strapiRequest<any>(`/blog-posts${q}`)).data || [];
  }
  async getBlogPost(id: string) { return (await this.strapiRequest<any>(`/blog-posts/${id}?populate=*`)).data; }
  async createBlogPost(data: any) { return (await this.strapiRequest<any>('/blog-posts', { method: 'POST', body: JSON.stringify({ data }) })).data; }
}
