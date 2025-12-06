import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsArray,
  IsEnum,
  ValidateNested,
  Min,
  IsUrl,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProductStatus } from '@prisma/client';

export class ProductImageDto {
  @IsUrl()
  url: string;

  @IsOptional()
  @IsString()
  alt?: string;

  @IsOptional()
  @IsNumber()
  order?: number;

  @IsOptional()
  @IsEnum(['IMAGE', 'VIDEO', 'IMAGE_360'])
  type?: string;
}

export class VariationOptionDto {
  @IsString()
  value: string;

  @IsOptional()
  @IsNumber()
  priceModifier?: number;

  @IsOptional()
  @IsNumber()
  stock?: number;

  @IsOptional()
  @IsString()
  sku?: string;
}

export class ProductVariationDto {
  @IsString()
  name: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariationOptionDto)
  options: VariationOptionDto[];
}

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

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
  @Min(0)
  stock: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductImageDto)
  images: ProductImageDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariationDto)
  variations?: ProductVariationDto[];

  @IsOptional()
  @IsString()
  fandom?: string;

  @IsOptional()
  @IsString()
  category?: string; // Keep for backward compatibility

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[]; // Keep for backward compatibility

  @IsOptional()
  @IsString()
  categoryId?: string; // New: taxonomy category ID

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductAttributeDto)
  attributes?: ProductAttributeDto[]; // New: product attributes

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagIds?: string[]; // New: taxonomy tag IDs

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;
}

export class ProductAttributeDto {
  @IsString()
  attributeId: string;

  @IsOptional()
  @IsString()
  attributeValueId?: string; // For SELECT type attributes

  @IsOptional()
  @IsString()
  textValue?: string; // For TEXT type

  @IsOptional()
  @IsNumber()
  numberValue?: number; // For NUMBER type

  @IsOptional()
  @IsBoolean()
  booleanValue?: boolean; // For BOOLEAN type

  @IsOptional()
  dateValue?: string; // For DATE type (ISO string)
}


