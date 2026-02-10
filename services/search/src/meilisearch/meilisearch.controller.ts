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
import { Public, GatewayAuthGuard, RolesGuard, Roles } from '@hos-marketplace/auth-common';

@ApiTags('meilisearch')
@Controller('meilisearch')
export class MeilisearchController {
  constructor(private readonly meilisearchService: MeilisearchService) {}

  @Public()
  @Get('search')
  @ApiOperation({
    summary: 'Search products with Meilisearch',
    description: 'Fast, typo-tolerant product search with faceted filtering.',
  })
  @ApiQuery({ name: 'q', required: false, type: String })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'categoryId', required: false, type: String })
  @ApiQuery({ name: 'fandom', required: false, type: String })
  @ApiQuery({ name: 'sellerId', required: false, type: String })
  @ApiQuery({ name: 'minPrice', required: false, type: Number })
  @ApiQuery({ name: 'maxPrice', required: false, type: Number })
  @ApiQuery({ name: 'minRating', required: false, type: Number })
  @ApiQuery({ name: 'inStock', required: false, type: String })
  @ApiQuery({ name: 'tags', required: false, type: String })
  @ApiQuery({ name: 'sort', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @SwaggerApiResponse({ status: 200, description: 'Search results returned' })
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
  ) {
    const filters: SearchFilters = { page, limit: Math.min(limit, 100), sort };

    if (category) filters.category = category;
    if (categoryId) filters.categoryId = categoryId;
    if (fandom) filters.fandom = fandom;
    if (sellerId) filters.sellerId = sellerId;
    if (minPrice) filters.minPrice = parseFloat(minPrice);
    if (maxPrice) filters.maxPrice = parseFloat(maxPrice);
    if (minRating) filters.minRating = parseFloat(minRating);
    if (inStock === 'true') filters.inStock = true;
    if (tags)
      filters.tags = tags.split(',').map((t) => t.trim()).filter(Boolean);

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
  @ApiOperation({ summary: 'Instant search (lightweight)' })
  @ApiQuery({ name: 'q', required: true, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @SwaggerApiResponse({ status: 200, description: 'Instant search results' })
  async instantSearch(
    @Query('q') query: string,
    @Query('limit', new DefaultValuePipe(5), ParseIntPipe) limit: number = 5,
  ) {
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

    const products = result.hits.map((hit: any) => ({
      id: hit.id,
      name: hit.name,
      slug: hit.slug,
      price: hit.price,
      currency: hit.currency,
      image: hit.images?.[0]?.url || null,
    }));

    return {
      data: { products, total: result.total, processingTimeMs: result.processingTimeMs },
      message: 'Instant search completed',
    };
  }

  @Public()
  @Get('suggestions')
  @ApiOperation({ summary: 'Get search suggestions (autocomplete)' })
  @ApiQuery({ name: 'q', required: true, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @SwaggerApiResponse({ status: 200, description: 'Suggestions returned' })
  async getSuggestions(
    @Query('q') prefix: string,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
  ) {
    if (!prefix || prefix.trim().length < 2) {
      return { data: [], message: 'Prefix too short (minimum 2 characters)' };
    }

    const suggestions = await this.meilisearchService.getSuggestions(prefix, limit);
    return { data: suggestions, message: 'Suggestions retrieved successfully' };
  }

  @Public()
  @Get('stats')
  @ApiOperation({ summary: 'Get search index statistics' })
  @SwaggerApiResponse({ status: 200, description: 'Stats returned' })
  async getStats() {
    const stats = await this.meilisearchService.getStats();
    return {
      data: stats,
      message: stats.available ? 'Meilisearch is available' : 'Meilisearch is not available',
    };
  }

  @UseGuards(GatewayAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sync all products to search index (Admin only)' })
  @SwaggerApiResponse({ status: 200, description: 'Sync completed' })
  async syncProducts() {
    const result = await this.meilisearchService.syncAllProducts();
    return {
      data: result,
      message: `Sync complete: ${result.indexed} indexed, ${result.failed} failed`,
    };
  }

  @UseGuards(GatewayAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('rebuild')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Rebuild search index (Admin only)' })
  @SwaggerApiResponse({ status: 200, description: 'Rebuild completed' })
  async rebuildIndex() {
    await this.meilisearchService.rebuildIndex();
    return { data: null, message: 'Index rebuild completed successfully' };
  }
}
