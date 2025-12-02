import { PartialType } from '@nestjs/mapped-types';
import { CreateProductDto } from './create-product.dto';
import { IsOptional } from 'class-validator';

// Use PartialType if available, otherwise define manually
export class UpdateProductDto {
  @IsOptional()
  name?: string;

  @IsOptional()
  description?: string;

  @IsOptional()
  sku?: string;

  @IsOptional()
  barcode?: string;

  @IsOptional()
  ean?: string;

  @IsOptional()
  price?: number;

  @IsOptional()
  tradePrice?: number;

  @IsOptional()
  rrp?: number;

  @IsOptional()
  currency?: string;

  @IsOptional()
  taxRate?: number;

  @IsOptional()
  stock?: number;

  @IsOptional()
  images?: Array<{
    url: string;
    alt?: string;
    order?: number;
    type?: string;
  }>;

  @IsOptional()
  variations?: Array<{
    name: string;
    options: Array<{
      value: string;
      priceModifier?: number;
      stock?: number;
      sku?: string;
    }>;
  }>;

  @IsOptional()
  fandom?: string;

  @IsOptional()
  category?: string;

  @IsOptional()
  tags?: string[];

  @IsOptional()
  status?: string;
}

