import {
  Controller,
  Get,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { ElasticSearchService } from './search.service';
import { Public } from '@hos-marketplace/auth-common';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: ElasticSearchService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Search products',
    description:
      'Searches products using Elasticsearch with advanced filtering options including attribute-based faceted search.',
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
  @ApiQuery({ name: 'attributes', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
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
  ) {
    const filters: any = {
      page,
      limit: Math.min(limit, 100),
    };

    if (category) filters.category = category;
    if (categoryId) filters.categoryId = categoryId;
    if (fandom) filters.fandom = fandom;
    if (sellerId) filters.sellerId = sellerId;
    if (minPrice) filters.minPrice = parseFloat(minPrice);
    if (maxPrice) filters.maxPrice = parseFloat(maxPrice);
    if (minRating) filters.minRating = parseFloat(minRating);
    if (inStock === 'true') filters.inStock = true;

    if (attributes) {
      try {
        const parsedAttributes = JSON.parse(attributes);
        if (Array.isArray(parsedAttributes)) {
          filters.attributes = parsedAttributes.map((attr: any) => {
            const attrFilter: any = { attributeId: attr.attributeId };
            if (attr.values && Array.isArray(attr.values)) attrFilter.values = attr.values;
            if (attr.minValue !== undefined) attrFilter.minValue = parseFloat(attr.minValue);
            if (attr.maxValue !== undefined) attrFilter.maxValue = parseFloat(attr.maxValue);
            if (attr.booleanValue !== undefined) {
              attrFilter.booleanValue = attr.booleanValue === true || attr.booleanValue === 'true';
            }
            if (attr.textValue) attrFilter.textValue = attr.textValue;
            return attrFilter;
          });
        }
      } catch {
        // Invalid JSON - ignore attribute filters
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
  @ApiOperation({ summary: 'Get search suggestions' })
  @ApiQuery({ name: 'q', required: true, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @SwaggerApiResponse({ status: 200, description: 'Suggestions retrieved successfully' })
  async getSuggestions(
    @Query('q') prefix: string,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
  ) {
    if (!prefix || prefix.trim().length < 2) {
      return { data: [], message: 'Suggestions retrieved successfully' };
    }

    const suggestions = await this.searchService.getSuggestions(prefix, limit);
    return { data: suggestions, message: 'Suggestions retrieved successfully' };
  }
}
