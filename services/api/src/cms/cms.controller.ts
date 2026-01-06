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
import { CMSService } from './cms.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@Controller('cms')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CMS_EDITOR', 'ADMIN')
export class CMSController {
  constructor(private readonly cmsService: CMSService) {}

  // Pages
  @Get('pages')
  async getPages(): Promise<ApiResponse<any[]>> {
    return this.cmsService.getPages();
  }

  @Get('pages/:id')
  async getPage(@Param('id') id: string): Promise<ApiResponse<any>> {
    return this.cmsService.getPage(id);
  }

  @Post('pages')
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
  async deletePage(@Param('id') id: string): Promise<ApiResponse<any>> {
    return this.cmsService.deletePage(id);
  }

  // Banners
  @Get('banners')
  async getBanners(
    @Query('type') type?: 'hero' | 'promotional' | 'sidebar',
  ): Promise<ApiResponse<any[]>> {
    return this.cmsService.getBanners(type);
  }

  @Get('banners/:id')
  async getBanner(@Param('id') id: string): Promise<ApiResponse<any>> {
    return this.cmsService.getBanner(id);
  }

  @Post('banners')
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
  async deleteBanner(@Param('id') id: string): Promise<ApiResponse<any>> {
    return this.cmsService.deleteBanner(id);
  }

  // Blog Posts
  @Get('blog')
  async getBlogPosts(@Query('limit') limit?: number): Promise<ApiResponse<any[]>> {
    return this.cmsService.getBlogPosts(limit ? parseInt(limit.toString(), 10) : undefined);
  }

  @Get('blog/:id')
  async getBlogPost(@Param('id') id: string): Promise<ApiResponse<any>> {
    return this.cmsService.getBlogPost(id);
  }

  @Post('blog')
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
  async deleteBlogPost(@Param('id') id: string): Promise<ApiResponse<any>> {
    return this.cmsService.deleteBlogPost(id);
  }

  @Post('blog/:id/publish')
  async publishBlogPost(@Param('id') id: string): Promise<ApiResponse<any>> {
    return this.cmsService.publishBlogPost(id);
  }
}



