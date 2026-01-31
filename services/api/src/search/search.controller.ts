import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
  DefaultValuePipe,
  ParseFloatPipe,
  Optional,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { SearchService } from './search.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Search products',
    description:
      'Searches products using Elasticsearch with advanced filtering options including attribute-based faceted search. Public endpoint, no authentication required.',
  })
  @ApiQuery({ name: 'q', required: false, type: String, description: 'Search query string' })
  @ApiQuery({
    name: 'category',
    required: false,
    type: String,
    description: 'Filter by category (legacy)',
  })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    type: String,
    description: 'Filter by category ID',
  })
  @ApiQuery({ name: 'fandom', required: false, type: String, description: 'Filter by fandom' })
  @ApiQuery({ name: 'sellerId', required: false, type: String, description: 'Filter by seller ID' })
  @ApiQuery({
    name: 'minPrice',
    required: false,
    type: Number,
    description: 'Minimum price filter',
  })
  @ApiQuery({
    name: 'maxPrice',
    required: false,
    type: Number,
    description: 'Maximum price filter',
  })
  @ApiQuery({
    name: 'minRating',
    required: false,
    type: Number,
    description: 'Minimum rating filter',
  })
  @ApiQuery({
    name: 'inStock',
    required: false,
    type: String,
    description: 'Filter by stock availability (true/false)',
  })
  @ApiQuery({
    name: 'attributes',
    required: false,
    type: String,
    description:
      'JSON array of attribute filters: [{"attributeId":"id","values":["val1","val2"]}] or for NUMBER: [{"attributeId":"id","minValue":10,"maxValue":100}]',
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
  @SwaggerApiResponse({ status: 200, description: 'Search completed successfully' })
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
    @Query('attributes') attributes?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number = 20,
  ): Promise<ApiResponse<any>> {
    const filters: any = {
      page,
      limit: Math.min(limit, 100), // Max 100 per page
    };

    if (category) filters.category = category;
    if (categoryId) filters.categoryId = categoryId;
    if (fandom) filters.fandom = fandom;
    if (sellerId) filters.sellerId = sellerId;
    if (minPrice) filters.minPrice = parseFloat(minPrice);
    if (maxPrice) filters.maxPrice = parseFloat(maxPrice);
    if (minRating) filters.minRating = parseFloat(minRating);
    if (inStock === 'true') filters.inStock = true;

    // Parse attribute filters from JSON string
    if (attributes) {
      try {
        const parsedAttributes = JSON.parse(attributes);
        if (Array.isArray(parsedAttributes)) {
          filters.attributes = parsedAttributes.map((attr: any) => {
            const attrFilter: any = {
              attributeId: attr.attributeId,
            };

            // SELECT type - array of value slugs
            if (attr.values && Array.isArray(attr.values)) {
              attrFilter.values = attr.values;
            }

            // NUMBER type - min/max range
            if (attr.minValue !== undefined) {
              attrFilter.minValue = parseFloat(attr.minValue);
            }
            if (attr.maxValue !== undefined) {
              attrFilter.maxValue = parseFloat(attr.maxValue);
            }

            // BOOLEAN type
            if (attr.booleanValue !== undefined) {
              attrFilter.booleanValue = attr.booleanValue === true || attr.booleanValue === 'true';
            }

            // TEXT type - partial match
            if (attr.textValue) {
              attrFilter.textValue = attr.textValue;
            }

            return attrFilter;
          });
        }
      } catch (error) {
        // Invalid JSON - ignore attribute filters
        // Could log error in production
      }
    }

    const result = await this.searchService.search(query, filters);

    return {
      data: {
        products: result.hits,
        total: result.total,
        page,
        limit,
        totalPages: Math.ceil(result.total / limit),
        aggregations: result.aggregations,
      },
      message: 'Search completed successfully',
    };
  }

  @Public()
  @Get('suggestions')
  @ApiOperation({
    summary: 'Get search suggestions',
    description:
      'Returns search suggestions/autocomplete results based on the query prefix. Public endpoint, no authentication required.',
  })
  @ApiQuery({
    name: 'q',
    required: true,
    type: String,
    description: 'Search prefix (minimum 2 characters)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of suggestions (default: 10)',
  })
  @SwaggerApiResponse({ status: 200, description: 'Suggestions retrieved successfully' })
  async getSuggestions(
    @Query('q') prefix: string,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
  ): Promise<ApiResponse<string[]>> {
    if (!prefix || prefix.trim().length < 2) {
      return {
        data: [],
        message: 'Suggestions retrieved successfully',
      };
    }

    const suggestions = await this.searchService.getSuggestions(prefix, limit);

    return {
      data: suggestions,
      message: 'Suggestions retrieved successfully',
    };
  }
}
