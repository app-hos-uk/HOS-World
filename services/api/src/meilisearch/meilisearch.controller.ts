import {
  Controller,
  Get,
  Post,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { MeilisearchService, SearchFilters } from './meilisearch.service';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('meilisearch')
@Controller('meilisearch')
export class MeilisearchController {
  constructor(private readonly meilisearchService: MeilisearchService) {}

  @Public()
  @Get('search')
  @ApiOperation({
    summary: 'Search products with Meilisearch',
    description: 'Fast, typo-tolerant product search with faceted filtering. Public endpoint.',
  })
  @ApiQuery({
    name: 'q',
    required: false,
    type: String,
    description: 'Search query (supports typos)',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    type: String,
    description: 'Filter by category name',
  })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    type: String,
    description: 'Filter by category ID',
  })
  @ApiQuery({ name: 'fandom', required: false, type: String, description: 'Filter by fandom' })
  @ApiQuery({ name: 'sellerId', required: false, type: String, description: 'Filter by seller ID' })
  @ApiQuery({ name: 'minPrice', required: false, type: Number, description: 'Minimum price' })
  @ApiQuery({ name: 'maxPrice', required: false, type: Number, description: 'Maximum price' })
  @ApiQuery({
    name: 'minRating',
    required: false,
    type: Number,
    description: 'Minimum rating (0-5)',
  })
  @ApiQuery({
    name: 'inStock',
    required: false,
    type: String,
    description: 'Only show in-stock items (true/false)',
  })
  @ApiQuery({ name: 'tags', required: false, type: String, description: 'Comma-separated tags' })
  @ApiQuery({
    name: 'sort',
    required: false,
    type: String,
    description: 'Sort: price_asc, price_desc, newest, rating, popular, name_asc, name_desc',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 20, max: 100)',
  })
  @SwaggerApiResponse({ status: 200, description: 'Search results returned successfully' })
  async search(
    @Query('q') query: string = '',
    @Query('category') category?: string,
    @Query('categoryId') categoryId?: string,
    @Query('fandom') fandom?: string,
    @Query('sellerId') sellerId?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('minRating') minRating?: string,
    @Query('inStock') inStock?: string,
    @Query('tags') tags?: string,
    @Query('sort') sort?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number = 20,
  ): Promise<ApiResponse<any>> {
    const filters: SearchFilters = {
      page,
      limit: Math.min(limit, 100),
      sort,
    };

    if (category) filters.category = category;
    if (categoryId) filters.categoryId = categoryId;
    if (fandom) filters.fandom = fandom;
    if (sellerId) filters.sellerId = sellerId;
    if (minPrice) filters.minPrice = parseFloat(minPrice);
    if (maxPrice) filters.maxPrice = parseFloat(maxPrice);
    if (minRating) filters.minRating = parseFloat(minRating);
    if (inStock === 'true') filters.inStock = true;
    if (tags)
      filters.tags = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

    const result = await this.meilisearchService.search(query, filters);

    return {
      data: {
        products: result.hits,
        total: result.total,
        page,
        limit,
        totalPages: Math.ceil(result.total / limit),
        processingTimeMs: result.processingTimeMs,
        facets: result.facetDistribution,
        query: result.query,
      },
      message: 'Search completed successfully',
    };
  }

  @Public()
  @Get('instant')
  @ApiOperation({
    summary: 'Instant search (lightweight)',
    description: 'Optimized for as-you-type search with minimal response payload.',
  })
  @ApiQuery({ name: 'q', required: true, type: String, description: 'Search query' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Max results (default: 5)',
  })
  @SwaggerApiResponse({ status: 200, description: 'Instant search results' })
  async instantSearch(
    @Query('q') query: string,
    @Query('limit', new DefaultValuePipe(5), ParseIntPipe) limit: number = 5,
  ): Promise<ApiResponse<any>> {
    if (!query || query.trim().length < 1) {
      return {
        data: { products: [], total: 0, processingTimeMs: 0 },
        message: 'Query too short',
      };
    }

    const result = await this.meilisearchService.search(query, {
      limit: Math.min(limit, 10),
      page: 1,
    });

    // Return minimal data for instant search
    const products = result.hits.map((hit: any) => ({
      id: hit.id,
      name: hit.name,
      slug: hit.slug,
      price: hit.price,
      currency: hit.currency,
      image: hit.images?.[0]?.url || null,
    }));

    return {
      data: {
        products,
        total: result.total,
        processingTimeMs: result.processingTimeMs,
      },
      message: 'Instant search completed',
    };
  }

  @Public()
  @Get('suggestions')
  @ApiOperation({
    summary: 'Get search suggestions (autocomplete)',
    description: 'Returns product name suggestions based on query prefix.',
  })
  @ApiQuery({ name: 'q', required: true, type: String, description: 'Search prefix (min 2 chars)' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Max suggestions (default: 10)',
  })
  @SwaggerApiResponse({ status: 200, description: 'Suggestions returned successfully' })
  async getSuggestions(
    @Query('q') prefix: string,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
  ): Promise<ApiResponse<string[]>> {
    if (!prefix || prefix.trim().length < 2) {
      return {
        data: [],
        message: 'Prefix too short (minimum 2 characters)',
      };
    }

    const suggestions = await this.meilisearchService.getSuggestions(prefix, limit);

    return {
      data: suggestions,
      message: 'Suggestions retrieved successfully',
    };
  }

  @Public()
  @Get('stats')
  @ApiOperation({
    summary: 'Get search index statistics',
    description: 'Returns Meilisearch index statistics and health status.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Stats returned successfully' })
  async getStats(): Promise<ApiResponse<any>> {
    const stats = await this.meilisearchService.getStats();

    return {
      data: stats,
      message: stats.available ? 'Meilisearch is available' : 'Meilisearch is not available',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Sync all products to search index',
    description: 'Triggers a full product sync from database to Meilisearch. Admin only.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Sync completed' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin only' })
  async syncProducts(): Promise<ApiResponse<any>> {
    const result = await this.meilisearchService.syncAllProducts();

    return {
      data: result,
      message: `Sync complete: ${result.indexed} indexed, ${result.failed} failed`,
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('rebuild')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Rebuild search index',
    description: 'Drops and recreates the search index with fresh settings. Admin only.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Rebuild completed' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin only' })
  async rebuildIndex(): Promise<ApiResponse<null>> {
    await this.meilisearchService.rebuildIndex();

    return {
      data: null,
      message: 'Index rebuild completed successfully',
    };
  }
}
