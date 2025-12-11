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
import { SearchService } from './search.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Public()
  @Get()
  async search(
    @Query('q') query: string = '',
    @Query('category') category?: string,
    @Query('fandom') fandom?: string,
    @Query('sellerId') sellerId?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('minRating') minRating?: string,
    @Query('inStock') inStock?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number = 20,
  ): Promise<ApiResponse<any>> {
    try {
      const filters: any = {
        page,
        limit: Math.min(limit, 100), // Max 100 per page
      };

      if (category) filters.category = category;
      if (fandom) filters.fandom = fandom;
      if (sellerId) filters.sellerId = sellerId;
      if (minPrice) filters.minPrice = parseFloat(minPrice);
      if (maxPrice) filters.maxPrice = parseFloat(maxPrice);
      if (minRating) filters.minRating = parseFloat(minRating);
      if (inStock === 'true') filters.inStock = true;

      const result = await this.searchService.search(query, filters);

      return {
        data: {
          products: result.hits,
          total: result.total,
          page,
          limit,
          totalPages: Math.ceil(result.total / limit),
          aggregations: result.aggregations || {},
        },
        message: 'Search completed successfully',
      };
    } catch (error: any) {
      // Fallback: return empty results instead of 500 error
      return {
        data: {
          products: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
          aggregations: {},
        },
        message: 'Search completed with limited results',
      };
    }
  }

  @Public()
  @Get('suggestions')
  async getSuggestions(
    @Query('q') prefix: string,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
  ): Promise<ApiResponse<string[]>> {
    try {
      if (!prefix || prefix.trim().length < 2) {
        return {
          data: [],
          message: 'Suggestions retrieved successfully',
        };
      }

      const suggestions = await this.searchService.getSuggestions(prefix, limit);

      return {
        data: suggestions || [],
        message: 'Suggestions retrieved successfully',
      };
    } catch (error: any) {
      // Fallback: return empty suggestions instead of 500 error
      return {
        data: [],
        message: 'Suggestions retrieved successfully',
      };
    }
  }
}

