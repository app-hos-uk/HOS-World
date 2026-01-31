import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@Injectable()
export class CMSService {
  private strapiUrl: string;
  private strapiToken: string | null;

  constructor(private configService: ConfigService) {
    this.strapiUrl = this.configService.get<string>('STRAPI_URL') || 'http://localhost:1337/api';
    this.strapiToken = this.configService.get<string>('STRAPI_API_TOKEN') || null;
  }

  private async strapiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (this.strapiToken) {
      headers['Authorization'] = `Bearer ${this.strapiToken}`;
    }

    try {
      const response = await fetch(`${this.strapiUrl}${endpoint}`, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new HttpException(`Strapi API error: ${errorText}`, response.status);
      }

      return await response.json();
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to connect to Strapi: ${error.message}`,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  // Pages
  async getPages(): Promise<ApiResponse<any[]>> {
    try {
      const data = await this.strapiRequest<any>(`/pages?populate=*`);
      return {
        data: data.data || [],
        message: 'Pages retrieved successfully',
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to fetch pages',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getPage(id: string): Promise<ApiResponse<any>> {
    try {
      const data = await this.strapiRequest<any>(`/pages/${id}?populate=*`);
      return {
        data: data.data || null,
        message: 'Page retrieved successfully',
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to fetch page',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async createPage(pageData: {
    title: string;
    slug: string;
    content: string;
    metaTitle?: string;
    metaDescription?: string;
    keywords?: string;
  }): Promise<ApiResponse<any>> {
    try {
      const data = await this.strapiRequest<any>('/pages', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            title: pageData.title,
            slug: pageData.slug,
            content: pageData.content,
            seo: {
              metaTitle: pageData.metaTitle,
              metaDescription: pageData.metaDescription,
              keywords: pageData.keywords,
            },
          },
        }),
      });
      return {
        data: data.data || null,
        message: 'Page created successfully',
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to create page',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async updatePage(
    id: string,
    pageData: {
      title?: string;
      slug?: string;
      content?: string;
      metaTitle?: string;
      metaDescription?: string;
      keywords?: string;
    },
  ): Promise<ApiResponse<any>> {
    try {
      const data = await this.strapiRequest<any>(`/pages/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          data: {
            ...(pageData.title && { title: pageData.title }),
            ...(pageData.slug && { slug: pageData.slug }),
            ...(pageData.content && { content: pageData.content }),
            ...((pageData.metaTitle || pageData.metaDescription || pageData.keywords) && {
              seo: {
                ...(pageData.metaTitle && { metaTitle: pageData.metaTitle }),
                ...(pageData.metaDescription && { metaDescription: pageData.metaDescription }),
                ...(pageData.keywords && { keywords: pageData.keywords }),
              },
            }),
          },
        }),
      });
      return {
        data: data.data || null,
        message: 'Page updated successfully',
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to update page',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async deletePage(id: string): Promise<ApiResponse<any>> {
    try {
      await this.strapiRequest<any>(`/pages/${id}`, {
        method: 'DELETE',
      });
      return {
        data: null,
        message: 'Page deleted successfully',
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to delete page',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Banners
  async getBanners(type?: 'hero' | 'promotional' | 'sidebar'): Promise<ApiResponse<any[]>> {
    try {
      const filter = type ? `?filters[type][$eq]=${type}&populate=*` : '?populate=*';
      const data = await this.strapiRequest<any>(`/banners${filter}`);
      return {
        data: data.data || [],
        message: 'Banners retrieved successfully',
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to fetch banners',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getBanner(id: string): Promise<ApiResponse<any>> {
    try {
      const data = await this.strapiRequest<any>(`/banners/${id}?populate=*`);
      return {
        data: data.data || null,
        message: 'Banner retrieved successfully',
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to fetch banner',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async createBanner(bannerData: {
    title: string;
    type: 'hero' | 'promotional' | 'sidebar';
    image: string;
    link?: string;
    content?: string;
    active?: boolean;
  }): Promise<ApiResponse<any>> {
    try {
      const data = await this.strapiRequest<any>('/banners', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            title: bannerData.title,
            type: bannerData.type,
            image: bannerData.image,
            link: bannerData.link,
            content: bannerData.content,
            active: bannerData.active !== undefined ? bannerData.active : true,
          },
        }),
      });
      return {
        data: data.data || null,
        message: 'Banner created successfully',
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to create banner',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async updateBanner(
    id: string,
    bannerData: {
      title?: string;
      type?: 'hero' | 'promotional' | 'sidebar';
      image?: string;
      link?: string;
      content?: string;
      active?: boolean;
    },
  ): Promise<ApiResponse<any>> {
    try {
      const data = await this.strapiRequest<any>(`/banners/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          data: {
            ...(bannerData.title && { title: bannerData.title }),
            ...(bannerData.type && { type: bannerData.type }),
            ...(bannerData.image && { image: bannerData.image }),
            ...(bannerData.link !== undefined && { link: bannerData.link }),
            ...(bannerData.content !== undefined && { content: bannerData.content }),
            ...(bannerData.active !== undefined && { active: bannerData.active }),
          },
        }),
      });
      return {
        data: data.data || null,
        message: 'Banner updated successfully',
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to update banner',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async deleteBanner(id: string): Promise<ApiResponse<any>> {
    try {
      await this.strapiRequest<any>(`/banners/${id}`, {
        method: 'DELETE',
      });
      return {
        data: null,
        message: 'Banner deleted successfully',
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to delete banner',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Blog Posts
  async getBlogPosts(limit?: number): Promise<ApiResponse<any[]>> {
    try {
      const pagination = limit ? `?pagination[limit]=${limit}&populate=*` : '?populate=*';
      const data = await this.strapiRequest<any>(`/blog-posts${pagination}`);
      return {
        data: data.data || [],
        message: 'Blog posts retrieved successfully',
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to fetch blog posts',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getBlogPost(id: string): Promise<ApiResponse<any>> {
    try {
      const data = await this.strapiRequest<any>(`/blog-posts/${id}?populate=*`);
      return {
        data: data.data || null,
        message: 'Blog post retrieved successfully',
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to fetch blog post',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async createBlogPost(postData: {
    title: string;
    slug: string;
    excerpt: string;
    content: string;
    coverImage?: string;
    author?: string;
  }): Promise<ApiResponse<any>> {
    try {
      const data = await this.strapiRequest<any>('/blog-posts', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            title: postData.title,
            slug: postData.slug,
            excerpt: postData.excerpt,
            content: postData.content,
            coverImage: postData.coverImage,
            author: postData.author,
          },
        }),
      });
      return {
        data: data.data || null,
        message: 'Blog post created successfully',
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to create blog post',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async updateBlogPost(
    id: string,
    postData: {
      title?: string;
      slug?: string;
      excerpt?: string;
      content?: string;
      coverImage?: string;
      author?: string;
      publishedAt?: string;
    },
  ): Promise<ApiResponse<any>> {
    try {
      const data = await this.strapiRequest<any>(`/blog-posts/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          data: {
            ...(postData.title && { title: postData.title }),
            ...(postData.slug && { slug: postData.slug }),
            ...(postData.excerpt && { excerpt: postData.excerpt }),
            ...(postData.content && { content: postData.content }),
            ...(postData.coverImage && { coverImage: postData.coverImage }),
            ...(postData.author && { author: postData.author }),
            ...(postData.publishedAt && { publishedAt: postData.publishedAt }),
          },
        }),
      });
      return {
        data: data.data || null,
        message: 'Blog post updated successfully',
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to update blog post',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async deleteBlogPost(id: string): Promise<ApiResponse<any>> {
    try {
      await this.strapiRequest<any>(`/blog-posts/${id}`, {
        method: 'DELETE',
      });
      return {
        data: null,
        message: 'Blog post deleted successfully',
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to delete blog post',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async publishBlogPost(id: string): Promise<ApiResponse<any>> {
    try {
      const data = await this.strapiRequest<any>(`/blog-posts/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          data: {
            publishedAt: new Date().toISOString(),
          },
        }),
      });
      return {
        data: data.data || null,
        message: 'Blog post published successfully',
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to publish blog post',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
