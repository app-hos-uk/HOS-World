import {
  IsOptional,
  IsString,
  IsNumber,
  IsBoolean,
  IsEnum,
  IsArray,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum SortBy {
  RELEVANCE = 'relevance',
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
  NEWEST = 'newest',
  POPULAR = 'popular',
}

export class SearchProductsDto {
  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsString()
  status?: string; // Filter by product status (ACTIVE, DRAFT, INACTIVE, OUT_OF_STOCK)

  @IsOptional()
  @IsString()
  fandom?: string;

  @IsOptional()
  @IsString()
  category?: string; // Keep for backward compatibility

  @IsOptional()
  @IsString()
  categoryId?: string; // New: taxonomy category ID

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagIds?: string[]; // New: taxonomy tag IDs

  @IsOptional()
  @IsArray()
  attributeFilters?: Array<{
    attributeId: string;
    value?: string;
    minValue?: number;
    maxValue?: number;
  }>; // New: attribute filters

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @IsString()
  sellerId?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  inStock?: boolean;

  @IsOptional()
  @IsEnum(SortBy)
  sortBy?: SortBy;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}
