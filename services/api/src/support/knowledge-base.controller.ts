import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { KnowledgeBaseService } from './knowledge-base.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@Controller('support/kb')
export class KnowledgeBaseController {
  constructor(private readonly knowledgeBaseService: KnowledgeBaseService) {}

  @Public()
  @Get('articles')
  async getArticles(
    @Query('category') category?: string,
    @Query('tags') tags?: string,
    @Query('isPublished') isPublished?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ApiResponse<any>> {
    const result = await this.knowledgeBaseService.getArticles({
      category,
      tags: tags ? tags.split(',') : undefined,
      isPublished: isPublished === 'true' ? true : isPublished === 'false' ? false : undefined,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return {
      data: result,
      message: 'Articles retrieved successfully',
    };
  }

  @Public()
  @Get('search')
  async searchArticles(
    @Query('q') query: string,
    @Query('category') category?: string,
    @Query('tags') tags?: string,
    @Query('limit') limit?: string,
  ): Promise<ApiResponse<any[]>> {
    const articles = await this.knowledgeBaseService.searchArticles(query, {
      category,
      tags: tags ? tags.split(',') : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return {
      data: articles,
      message: 'Search completed successfully',
    };
  }

  @Public()
  @Get('articles/:id')
  async getArticleById(@Param('id') id: string): Promise<ApiResponse<any>> {
    const article = await this.knowledgeBaseService.getArticleById(id);
    return {
      data: article,
      message: 'Article retrieved successfully',
    };
  }

  @Public()
  @Get('articles/slug/:slug')
  async getArticleBySlug(@Param('slug') slug: string): Promise<ApiResponse<any>> {
    const article = await this.knowledgeBaseService.getArticleBySlug(slug);
    return {
      data: article,
      message: 'Article retrieved successfully',
    };
  }

  @Public()
  @Post('articles/:id/helpful')
  async markArticleHelpful(@Param('id') id: string): Promise<ApiResponse<any>> {
    const article = await this.knowledgeBaseService.markArticleHelpful(id);
    return {
      data: article,
      message: 'Article marked as helpful',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('articles')
  async createArticle(
    @Body()
    body: {
      title: string;
      content: string;
      category: string;
      tags?: string[];
      isPublished?: boolean;
    },
    @Request() req: any,
  ): Promise<ApiResponse<any>> {
    const article = await this.knowledgeBaseService.createArticle({
      ...body,
      createdBy: req.user.id,
    });
    return {
      data: article,
      message: 'Article created successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Put('articles/:id')
  async updateArticle(
    @Param('id') id: string,
    @Body()
    body: {
      title?: string;
      content?: string;
      category?: string;
      tags?: string[];
      isPublished?: boolean;
    },
  ): Promise<ApiResponse<any>> {
    const article = await this.knowledgeBaseService.updateArticle(id, body);
    return {
      data: article,
      message: 'Article updated successfully',
    };
  }
}

