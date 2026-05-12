import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@Injectable()
export class CMSService {
  private readonly logger = new Logger(CMSService.name);
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

    const base = this.strapiUrl.replace(/\/$/, '');
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${base}${path}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorSnippet = await response.text().catch(() => '');
        this.logger.warn(
          `Upstream CMS ${path} responded HTTP ${response.status}: ${errorSnippet.slice(0, 900)}`,
        );
        throw new HttpException(
          'The external content service could not complete this request. Check integration settings or try again later.',
          HttpStatus.BAD_GATEWAY,
        );
      }

      try {
        return (await response.json()) as T;
      } catch {
        this.logger.warn(`Upstream CMS ${path} returned a non-JSON body`);
        throw new HttpException(
          'The content service returned an unexpected response.',
          HttpStatus.BAD_GATEWAY,
        );
      }
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`CMS upstream unreachable (${path}): ${errMsg}`);
      throw new HttpException(
        'The content service could not be reached. Verify it is configured and reachable from the server.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /** Never leak raw upstream messages to HTTP clients */
  private rethrowAsClientSafe(error: unknown, userMessage: string): never {
    if (error instanceof HttpException) {
      throw error;
    }
    const detail = error instanceof Error ? error.message : String(error);
    this.logger.warn(`CMS unexpected: ${userMessage} (${detail})`);
    throw new HttpException(userMessage, HttpStatus.INTERNAL_SERVER_ERROR);
  }

  // Pages
  async getPages(): Promise<ApiResponse<any[]>> {
    try {
      const data = await this.strapiRequest<any>(`/pages?populate=*`);
      return {
        data: data.data || [],
        message: 'Pages retrieved successfully',
      };
    } catch (error: unknown) {
      this.rethrowAsClientSafe(error, 'Pages could not be loaded.');
    }
  }

  async getPage(id: string): Promise<ApiResponse<any>> {
    try {
      const data = await this.strapiRequest<any>(`/pages/${id}?populate=*`);
      return {
        data: data.data || null,
        message: 'Page retrieved successfully',
      };
    } catch (error: unknown) {
      this.rethrowAsClientSafe(error, 'Page could not be loaded.');
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
    } catch (error: unknown) {
      this.rethrowAsClientSafe(error, 'Page could not be created.');
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
    } catch (error: unknown) {
      this.rethrowAsClientSafe(error, 'Page could not be updated.');
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
    } catch (error: unknown) {
      this.rethrowAsClientSafe(error, 'Page could not be deleted.');
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
    } catch (error: unknown) {
      this.rethrowAsClientSafe(error, 'Banners could not be loaded.');
    }
  }

  async getBanner(id: string): Promise<ApiResponse<any>> {
    try {
      const data = await this.strapiRequest<any>(`/banners/${id}?populate=*`);
      return {
        data: data.data || null,
        message: 'Banner retrieved successfully',
      };
    } catch (error: unknown) {
      this.rethrowAsClientSafe(error, 'Banner could not be loaded.');
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
    } catch (error: unknown) {
      this.rethrowAsClientSafe(error, 'Banner could not be created.');
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
    } catch (error: unknown) {
      this.rethrowAsClientSafe(error, 'Banner could not be updated.');
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
    } catch (error: unknown) {
      this.rethrowAsClientSafe(error, 'Banner could not be deleted.');
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
    } catch (error: unknown) {
      this.rethrowAsClientSafe(error, 'Blog posts could not be loaded.');
    }
  }

  async getBlogPost(id: string): Promise<ApiResponse<any>> {
    try {
      const data = await this.strapiRequest<any>(`/blog-posts/${id}?populate=*`);
      return {
        data: data.data || null,
        message: 'Blog post retrieved successfully',
      };
    } catch (error: unknown) {
      this.rethrowAsClientSafe(error, 'Blog post could not be loaded.');
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
    } catch (error: unknown) {
      this.rethrowAsClientSafe(error, 'Blog post could not be created.');
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
    } catch (error: unknown) {
      this.rethrowAsClientSafe(error, 'Blog post could not be updated.');
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
    } catch (error: unknown) {
      this.rethrowAsClientSafe(error, 'Blog post could not be deleted.');
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
    } catch (error: unknown) {
      this.rethrowAsClientSafe(error, 'Blog post could not be published.');
    }
  }

  async getMedia(): Promise<ApiResponse<any[]>> {
    try {
      const data = await this.strapiRequest<any>('/upload/files');
      return {
        data: Array.isArray(data) ? data : data?.data ?? [],
        message: 'Media retrieved successfully',
      };
    } catch (error: unknown) {
      this.rethrowAsClientSafe(error, 'Media library could not be loaded.');
    }
  }

  async deleteMedia(id: string): Promise<ApiResponse<null>> {
    try {
      await this.strapiRequest<any>(`/upload/files/${id}`, {
        method: 'DELETE',
      });
      return {
        data: null,
        message: 'Media deleted successfully',
      };
    } catch (error: unknown) {
      this.rethrowAsClientSafe(error, 'Media could not be removed.');
    }
  }
}
