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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { BlogService } from './blog.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { BlogStatus } from '@prisma/client';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('blog')
@Controller('blog')
export class BlogController {
  constructor(private readonly blogService: BlogService) {}

  // ── Public endpoints ──────────────────────────────────────────────

  @Public()
  @Get('posts')
  @ApiOperation({ summary: 'List published blog posts' })
  async getPublishedPosts(
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ApiResponse<any>> {
    const result = await this.blogService.getPublishedPosts({
      categorySlug: category,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return { data: result, message: 'Blog posts retrieved successfully' };
  }

  @Public()
  @Get('posts/:slug')
  @ApiOperation({ summary: 'Get published blog post by slug' })
  @ApiParam({ name: 'slug', type: String })
  async getPublishedPost(@Param('slug') slug: string): Promise<ApiResponse<any>> {
    const post = await this.blogService.getPublishedPostBySlug(slug);
    const related = await this.blogService.getRelatedPosts(post.id, post.categoryId);
    return { data: { post, related }, message: 'Blog post retrieved successfully' };
  }

  @Public()
  @Get('categories')
  @ApiOperation({ summary: 'List blog categories' })
  async getCategories(): Promise<ApiResponse<any[]>> {
    const categories = await this.blogService.getCategories();
    return { data: categories, message: 'Categories retrieved successfully' };
  }

  @Public()
  @Get('categories/:slug')
  @ApiOperation({ summary: 'Get category by slug' })
  @ApiParam({ name: 'slug', type: String })
  async getCategory(@Param('slug') slug: string): Promise<ApiResponse<any>> {
    const category = await this.blogService.getCategoryBySlug(slug);
    const posts = await this.blogService.getPublishedPosts({ categorySlug: slug });
    return { data: { category, posts }, message: 'Category retrieved successfully' };
  }

  @Public()
  @Get('search')
  @ApiOperation({ summary: 'Search published blog posts' })
  @ApiQuery({ name: 'q', required: true })
  @ApiQuery({ name: 'category', required: false })
  async searchPosts(
    @Query('q') q: string,
    @Query('category') category?: string,
  ): Promise<ApiResponse<any>> {
    const result = await this.blogService.searchPosts(q, category);
    return { data: result, message: 'Search completed successfully' };
  }

  // ── Admin endpoints ─────────────────────────────────────────────────

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CMS_EDITOR', 'ADMIN')
  @Get('admin/posts')
  @ApiOperation({ summary: 'List all blog posts (admin)' })
  async getAllPosts(@Query('limit') limit?: string): Promise<ApiResponse<any[]>> {
    const posts = await this.blogService.getAllPosts(
      limit ? parseInt(limit, 10) : 100,
    );
    return { data: posts, message: 'Blog posts retrieved successfully' };
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CMS_EDITOR', 'ADMIN')
  @Get('admin/posts/:id')
  @ApiOperation({ summary: 'Get blog post by ID (admin)' })
  @ApiParam({ name: 'id', type: String })
  async getPostById(@Param('id') id: string): Promise<ApiResponse<any>> {
    const post = await this.blogService.getPostById(id);
    return { data: post, message: 'Blog post retrieved successfully' };
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CMS_EDITOR', 'ADMIN')
  @Post('admin/posts')
  @ApiOperation({ summary: 'Create blog post' })
  async createPost(
    @Body()
    body: {
      title: string;
      slug?: string;
      excerpt: string;
      content: string;
      coverImage?: string;
      coverImageAlt?: string;
      coverImageTitle?: string;
      author: string;
      seoTitle?: string;
      metaDescription?: string;
      focusKeyword?: string;
      canonicalUrl?: string;
      categoryId?: string;
      status?: BlogStatus;
    },
  ): Promise<ApiResponse<any>> {
    const post = await this.blogService.createPost(body);
    return { data: post, message: 'Blog post created successfully' };
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CMS_EDITOR', 'ADMIN')
  @Put('admin/posts/:id')
  @ApiOperation({ summary: 'Update blog post' })
  @ApiParam({ name: 'id', type: String })
  async updatePost(
    @Param('id') id: string,
    @Body()
    body: {
      title?: string;
      slug?: string;
      excerpt?: string;
      content?: string;
      coverImage?: string;
      coverImageAlt?: string;
      coverImageTitle?: string;
      author?: string;
      seoTitle?: string;
      metaDescription?: string;
      focusKeyword?: string;
      canonicalUrl?: string;
      categoryId?: string | null;
      status?: BlogStatus;
    },
  ): Promise<ApiResponse<any>> {
    const post = await this.blogService.updatePost(id, body);
    return { data: post, message: 'Blog post updated successfully' };
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CMS_EDITOR', 'ADMIN')
  @Delete('admin/posts/:id')
  @ApiOperation({ summary: 'Delete blog post' })
  @ApiParam({ name: 'id', type: String })
  async deletePost(@Param('id') id: string): Promise<ApiResponse<null>> {
    await this.blogService.deletePost(id);
    return { data: null, message: 'Blog post deleted successfully' };
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CMS_EDITOR', 'ADMIN')
  @Post('admin/posts/:id/publish')
  @ApiOperation({ summary: 'Publish blog post' })
  @ApiParam({ name: 'id', type: String })
  async publishPost(@Param('id') id: string): Promise<ApiResponse<any>> {
    const post = await this.blogService.publishPost(id);
    return { data: post, message: 'Blog post published successfully' };
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CMS_EDITOR', 'ADMIN')
  @Post('admin/posts/:id/unpublish')
  @ApiOperation({ summary: 'Unpublish blog post' })
  @ApiParam({ name: 'id', type: String })
  async unpublishPost(@Param('id') id: string): Promise<ApiResponse<any>> {
    const post = await this.blogService.unpublishPost(id);
    return { data: post, message: 'Blog post unpublished successfully' };
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CMS_EDITOR', 'ADMIN')
  @Get('admin/categories')
  @ApiOperation({ summary: 'List all blog categories (admin)' })
  async getAllCategories(): Promise<ApiResponse<any[]>> {
    const categories = await this.blogService.getAllCategories();
    return { data: categories, message: 'Categories retrieved successfully' };
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CMS_EDITOR', 'ADMIN')
  @Post('admin/categories')
  @ApiOperation({ summary: 'Create blog category' })
  async createCategory(
    @Body() body: { name: string; slug?: string; description?: string },
  ): Promise<ApiResponse<any>> {
    const category = await this.blogService.createCategory(body);
    return { data: category, message: 'Category created successfully' };
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CMS_EDITOR', 'ADMIN')
  @Put('admin/categories/:id')
  @ApiOperation({ summary: 'Update blog category' })
  @ApiParam({ name: 'id', type: String })
  async updateCategory(
    @Param('id') id: string,
    @Body() body: { name?: string; slug?: string; description?: string },
  ): Promise<ApiResponse<any>> {
    const category = await this.blogService.updateCategory(id, body);
    return { data: category, message: 'Category updated successfully' };
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CMS_EDITOR', 'ADMIN')
  @Delete('admin/categories/:id')
  @ApiOperation({ summary: 'Delete blog category' })
  @ApiParam({ name: 'id', type: String })
  async deleteCategory(@Param('id') id: string): Promise<ApiResponse<null>> {
    await this.blogService.deleteCategory(id);
    return { data: null, message: 'Category deleted successfully' };
  }
}
