import { IsString, IsArray, IsNumber, IsOptional, IsBoolean, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class BundleItemDto {
  @IsString()
  productId: string;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  quantity: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  priceOverride?: number;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  order?: number;
}

export class CreateBundleDto {
  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price: number; // Bundle price

  @IsOptional()
  @IsString()
  sellerId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BundleItemDto)
  items: BundleItemDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  stock?: number;

  @IsOptional()
  @IsString()
  categoryId?: string;
}
