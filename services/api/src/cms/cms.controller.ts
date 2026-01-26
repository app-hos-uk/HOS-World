import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
Version,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { CMSService } from './cms.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('cms')
@ApiBearerAuth('JWT-auth')
@Version('1')
@Controller('cms')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CMS_EDITOR', 'ADMIN')
export class CMSController {
  constructor(private readonly cmsService: CMSService) {}

  // Pages
  @Get('pages')
  @ApiOperation({ summary: 'Get all pages', description: 'Retrieves all CMS pages. CMS Editor/Admin access required.' })
  @SwaggerApiResponse({ status: 200, description: 'Pages retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - CMS Editor/Admin access required' })
  async getPages(): Promise<ApiResponse<any[]>> {
    return this.cmsService.getPages();
  }

  @Get('pages/:id')
  @ApiOperation({ summary: 'Get page by ID', description: 'Retrieves a specific CMS page by ID. CMS Editor/Admin access required.' })
  @ApiParam({ name: 'id', description: 'Page ID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Page retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - CMS Editor/Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Page not found' })
  async getPage(@Param('id') id: string): Promise<ApiResponse<any>> {
    return this.cmsService.getPage(id);
  }

  @Post('pages')
  @ApiOperation({ summary: 'Create page', description: 'Creates a new CMS page. CMS Editor/Admin access required.' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['title', 'slug', 'content'],
      properties: {
        title: { type: 'string', description: 'Page title' },
        slug: { type: 'string', description: 'Page slug (URL-friendly)' },
        content: { type: 'string', description: 'Page content (HTML)' },
        metaTitle: { type: 'string', description: 'SEO meta title (optional)' },
        metaDescription: { type: 'string', description: 'SEO meta description (optional)' },
        keywords: { type: 'string', description: 'SEO keywords (optional)' },
      },
    },
  })
  @SwaggerApiResponse({ status: 201, description: 'Page created successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - CMS Editor/Admin access required' })
  async createPage(
    @Body()
    body: {
      title: string;
      slug: string;
      content: string;
      metaTitle?: string;
      metaDescription?: string;
      keywords?: string;
    },
  ): Promise<ApiResponse<any>> {
    return this.cmsService.createPage(body);
  }

  @Put('pages/:id')
  @ApiOperation({ summary: 'Update page', description: 'Updates an existing CMS page. CMS Editor/Admin access required.' })
  @ApiParam({ name: 'id', description: 'Page ID', type: String })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Page title (optional)' },
        slug: { type: 'string', description: 'Page slug (optional)' },
        content: { type: 'string', description: 'Page content (optional)' },
        metaTitle: { type: 'string', description: 'SEO meta title (optional)' },
        metaDescription: { type: 'string', description: 'SEO meta description (optional)' },
        keywords: { type: 'string', description: 'SEO keywords (optional)' },
      },
    },
  })
  @SwaggerApiResponse({ status: 200, description: 'Page updated successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - CMS Editor/Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Page not found' })
  async updatePage(
    @Param('id') id: string,
    @Body()
    body: {
      title?: string;
      slug?: string;
      content?: string;
      metaTitle?: string;
      metaDescription?: string;
      keywords?: string;
    },
  ): Promise<ApiResponse<any>> {
    return this.cmsService.updatePage(id, body);
  }

  @Delete('pages/:id')
  @ApiOperation({ summary: 'Delete page', description: 'Deletes a CMS page. CMS Editor/Admin access required.' })
  @ApiParam({ name: 'id', description: 'Page ID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Page deleted successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - CMS Editor/Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Page not found' })
  async deletePage(@Param('id') id: string): Promise<ApiResponse<any>> {
    return this.cmsService.deletePage(id);
  }

  // Banners
  @Get('banners')
  @ApiOperation({ summary: 'Get all banners', description: 'Retrieves all CMS banners with optional type filtering. CMS Editor/Admin access required.' })
  @ApiQuery({ name: 'type', required: false, enum: ['hero', 'promotional', 'sidebar'], description: 'Filter by banner type' })
  @SwaggerApiResponse({ status: 200, description: 'Banners retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - CMS Editor/Admin access required' })
  async getBanners(
    @Query('type') type?: 'hero' | 'promotional' | 'sidebar',
  ): Promise<ApiResponse<any[]>> {
    return this.cmsService.getBanners(type);
  }

  @Get('banners/:id')
  @ApiOperation({ summary: 'Get banner by ID', description: 'Retrieves a specific CMS banner by ID. CMS Editor/Admin access required.' })
  @ApiParam({ name: 'id', description: 'Banner ID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Banner retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - CMS Editor/Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Banner not found' })
  async getBanner(@Param('id') id: string): Promise<ApiResponse<any>> {
    return this.cmsService.getBanner(id);
  }

  @Post('banners')
  @ApiOperation({ summary: 'Create banner', description: 'Creates a new CMS banner. CMS Editor/Admin access required.' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['title', 'type', 'image'],
      properties: {
        title: { type: 'string', description: 'Banner title' },
        type: { type: 'string', enum: ['hero', 'promotional', 'sidebar'], description: 'Banner type' },
        image: { type: 'string', description: 'Banner image URL' },
        link: { type: 'string', description: 'Banner link URL (optional)' },
        content: { type: 'string', description: 'Banner content (optional)' },
        active: { type: 'boolean', description: 'Banner active status (optional)' },
      },
    },
  })
  @SwaggerApiResponse({ status: 201, description: 'Banner created successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - CMS Editor/Admin access required' })
  async createBanner(
    @Body()
    body: {
      title: string;
      type: 'hero' | 'promotional' | 'sidebar';
      image: string;
      link?: string;
      content?: string;
      active?: boolean;
    },
  ): Promise<ApiResponse<any>> {
    return this.cmsService.createBanner(body);
  }

  @Put('banners/:id')
  @ApiOperation({ summary: 'Update banner', description: 'Updates an existing CMS banner. CMS Editor/Admin access required.' })
  @ApiParam({ name: 'id', description: 'Banner ID', type: String })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Banner title (optional)' },
        type: { type: 'string', enum: ['hero', 'promotional', 'sidebar'], description: 'Banner type (optional)' },
        image: { type: 'string', description: 'Banner image URL (optional)' },
        link: { type: 'string', description: 'Banner link URL (optional)' },
        content: { type: 'string', description: 'Banner content (optional)' },
        active: { type: 'boolean', description: 'Banner active status (optional)' },
      },
    },
  })
  @SwaggerApiResponse({ status: 200, description: 'Banner updated successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - CMS Editor/Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Banner not found' })
  async updateBanner(
    @Param('id') id: string,
    @Body()
    body: {
      title?: string;
      type?: 'hero' | 'promotional' | 'sidebar';
      image?: string;
      link?: string;
      content?: string;
      active?: boolean;
    },
  ): Promise<ApiResponse<any>> {
    return this.cmsService.updateBanner(id, body);
  }

  @Delete('banners/:id')
  @ApiOperation({ summary: 'Delete banner', description: 'Deletes a CMS banner. CMS Editor/Admin access required.' })
  @ApiParam({ name: 'id', description: 'Banner ID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Banner deleted successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - CMS Editor/Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Banner not found' })
  async deleteBanner(@Param('id') id: string): Promise<ApiResponse<any>> {
    return this.cmsService.deleteBanner(id);
  }

  // Blog Posts
  @Get('blog')
  @ApiOperation({ summary: 'Get blog posts', description: 'Retrieves all blog posts with optional limit. CMS Editor/Admin access required.' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Maximum number of posts to retrieve' })
  @SwaggerApiResponse({ status: 200, description: 'Blog posts retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - CMS Editor/Admin access required' })
  async getBlogPosts(@Query('limit') limit?: number): Promise<ApiResponse<any[]>> {
    return this.cmsService.getBlogPosts(limit ? parseInt(limit.toString(), 10) : undefined);
  }

  @Get('blog/:id')
  @ApiOperation({ summary: 'Get blog post by ID', description: 'Retrieves a specific blog post by ID. CMS Editor/Admin access required.' })
  @ApiParam({ name: 'id', description: 'Blog post ID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Blog post retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - CMS Editor/Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Blog post not found' })
  async getBlogPost(@Param('id') id: string): Promise<ApiResponse<any>> {
    return this.cmsService.getBlogPost(id);
  }

  @Post('blog')
  @ApiOperation({ summary: 'Create blog post', description: 'Creates a new blog post. CMS Editor/Admin access required.' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['title', 'slug', 'excerpt', 'content'],
      properties: {
        title: { type: 'string', description: 'Blog post title' },
        slug: { type: 'string', description: 'Blog post slug (URL-friendly)' },
        excerpt: { type: 'string', description: 'Blog post excerpt' },
        content: { type: 'string', description: 'Blog post content (HTML)' },
        coverImage: { type: 'string', description: 'Cover image URL (optional)' },
        author: { type: 'string', description: 'Author name (optional)' },
      },
    },
  })
  @SwaggerApiResponse({ status: 201, description: 'Blog post created successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - CMS Editor/Admin access required' })
  async createBlogPost(
    @Body()
    body: {
      title: string;
      slug: string;
      excerpt: string;
      content: string;
      coverImage?: string;
      author?: string;
    },
  ): Promise<ApiResponse<any>> {
    return this.cmsService.createBlogPost(body);
  }

  @Put('blog/:id')
  @ApiOperation({ summary: 'Update blog post', description: 'Updates an existing blog post. CMS Editor/Admin access required.' })
  @ApiParam({ name: 'id', description: 'Blog post ID', type: String })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Blog post title (optional)' },
        slug: { type: 'string', description: 'Blog post slug (optional)' },
        excerpt: { type: 'string', description: 'Blog post excerpt (optional)' },
        content: { type: 'string', description: 'Blog post content (optional)' },
        coverImage: { type: 'string', description: 'Cover image URL (optional)' },
        author: { type: 'string', description: 'Author name (optional)' },
        publishedAt: { type: 'string', format: 'date-time', description: 'Publication date (optional)' },
      },
    },
  })
  @SwaggerApiResponse({ status: 200, description: 'Blog post updated successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - CMS Editor/Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Blog post not found' })
  async updateBlogPost(
    @Param('id') id: string,
    @Body()
    body: {
      title?: string;
      slug?: string;
      excerpt?: string;
      content?: string;
      coverImage?: string;
      author?: string;
      publishedAt?: string;
    },
  ): Promise<ApiResponse<any>> {
    return this.cmsService.updateBlogPost(id, body);
  }

  @Delete('blog/:id')
  @ApiOperation({ summary: 'Delete blog post', description: 'Deletes a blog post. CMS Editor/Admin access required.' })
  @ApiParam({ name: 'id', description: 'Blog post ID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Blog post deleted successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - CMS Editor/Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Blog post not found' })
  async deleteBlogPost(@Param('id') id: string): Promise<ApiResponse<any>> {
    return this.cmsService.deleteBlogPost(id);
  }

  @Post('blog/:id/publish')
  @ApiOperation({ summary: 'Publish blog post', description: 'Publishes a blog post. CMS Editor/Admin access required.' })
  @ApiParam({ name: 'id', description: 'Blog post ID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Blog post published successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - CMS Editor/Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Blog post not found' })
  async publishBlogPost(@Param('id') id: string): Promise<ApiResponse<any>> {
    return this.cmsService.publishBlogPost(id);
  }
}




