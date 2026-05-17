import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
  IsObject,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ProductImageSubmissionDto {
  @IsString()
  @IsNotEmpty()
  url: string;

  @IsOptional()
  @IsString()
  alt?: string;

  @IsOptional()
  @IsNumber()
  order?: number;
}

export class ProductVariationOptionSubmissionDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  value: string;
}

export class ProductVariationSubmissionDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsArray()
  @Type(() => ProductVariationOptionSubmissionDto)
  @ValidateNested({ each: true })
  options: ProductVariationOptionSubmissionDto[];
}

export class CreateSubmissionDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsOptional()
  @IsString()
  shortDescription?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsString()
  ean?: string;

  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  price: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tradePrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  rrp?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxRate?: number;

  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  stock: number;

  @IsOptional()
  @IsString()
  fandom?: string;

  @IsOptional()
  @IsString()
  category?: string; // Legacy field - kept for backward compatibility

  @IsOptional()
  @IsString()
  categoryId?: string; // New taxonomy category ID

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @Type(() => ProductImageSubmissionDto)
  @ValidateNested({ each: true })
  images?: ProductImageSubmissionDto[];

  @IsOptional()
  @IsArray()
  @Type(() => ProductVariationSubmissionDto)
  @ValidateNested({ each: true })
  variations?: ProductVariationSubmissionDto[];

  @IsOptional()
  @IsNumber()
  quantity?: number; // For wholesalers - quantity to submit
}
