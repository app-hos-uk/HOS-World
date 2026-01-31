import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { KnowledgeBaseService } from './knowledge-base.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('support')
@Controller('support/kb')
export class KnowledgeBaseController {
  constructor(private readonly knowledgeBaseService: KnowledgeBaseService) {}

  @Public()
  @Get('articles')
  @ApiOperation({
    summary: 'Get knowledge base articles',
    description:
      'Retrieves knowledge base articles with filtering options. Public endpoint, no authentication required.',
  })
  @ApiQuery({ name: 'category', required: false, type: String, description: 'Filter by category' })
  @ApiQuery({
    name: 'tags',
    required: false,
    type: String,
    description: 'Filter by tags (comma-separated)',
  })
  @ApiQuery({
    name: 'isPublished',
    required: false,
    type: String,
    description: 'Filter by published status (true/false)',
  })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search query' })
  @ApiQuery({ name: 'page', required: false, type: String, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: String, description: 'Items per page' })
  @SwaggerApiResponse({ status: 200, description: 'Articles retrieved successfully' })
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
  @ApiOperation({
    summary: 'Search knowledge base articles',
    description:
      'Searches knowledge base articles by query. Public endpoint, no authentication required.',
  })
  @ApiQuery({ name: 'q', required: true, type: String, description: 'Search query' })
  @ApiQuery({ name: 'category', required: false, type: String, description: 'Filter by category' })
  @ApiQuery({
    name: 'tags',
    required: false,
    type: String,
    description: 'Filter by tags (comma-separated)',
  })
  @ApiQuery({ name: 'limit', required: false, type: String, description: 'Maximum results' })
  @SwaggerApiResponse({ status: 200, description: 'Search completed successfully' })
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
  @ApiOperation({
    summary: 'Get article by ID',
    description:
      'Retrieves a specific knowledge base article by ID. Public endpoint, no authentication required.',
  })
  @ApiParam({ name: 'id', description: 'Article ID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Article retrieved successfully' })
  @SwaggerApiResponse({ status: 404, description: 'Article not found' })
  async getArticleById(@Param('id') id: string): Promise<ApiResponse<any>> {
    const article = await this.knowledgeBaseService.getArticleById(id);
    return {
      data: article,
      message: 'Article retrieved successfully',
    };
  }

  @Public()
  @Get('articles/slug/:slug')
  @ApiOperation({
    summary: 'Get article by slug',
    description:
      'Retrieves a specific knowledge base article by slug. Public endpoint, no authentication required.',
  })
  @ApiParam({ name: 'slug', description: 'Article slug', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Article retrieved successfully' })
  @SwaggerApiResponse({ status: 404, description: 'Article not found' })
  async getArticleBySlug(@Param('slug') slug: string): Promise<ApiResponse<any>> {
    const article = await this.knowledgeBaseService.getArticleBySlug(slug);
    return {
      data: article,
      message: 'Article retrieved successfully',
    };
  }

  @Public()
  @Post('articles/:id/helpful')
  @ApiOperation({
    summary: 'Mark article as helpful',
    description:
      'Marks a knowledge base article as helpful. Public endpoint, no authentication required.',
  })
  @ApiParam({ name: 'id', description: 'Article ID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Article marked as helpful' })
  @SwaggerApiResponse({ status: 404, description: 'Article not found' })
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
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create knowledge base article (Admin only)',
    description: 'Creates a new knowledge base article. Admin access required.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['title', 'content', 'category'],
      properties: {
        title: { type: 'string' },
        content: { type: 'string' },
        category: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        isPublished: { type: 'boolean' },
      },
    },
  })
  @SwaggerApiResponse({ status: 201, description: 'Article created successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
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
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update knowledge base article (Admin only)',
    description: 'Updates an existing knowledge base article. Admin access required.',
  })
  @ApiParam({ name: 'id', description: 'Article ID', type: String })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        content: { type: 'string' },
        category: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        isPublished: { type: 'boolean' },
      },
    },
  })
  @SwaggerApiResponse({ status: 200, description: 'Article updated successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Article not found' })
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
