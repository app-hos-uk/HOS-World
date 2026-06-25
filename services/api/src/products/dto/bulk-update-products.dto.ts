import { IsArray, IsEnum, IsNumber, IsOptional, IsUUID } from 'class-validator';
import { ProductStatus } from '@prisma/client';

export class BulkUpdateProductsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  productIds: string[];

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsOptional()
  @IsNumber()
  stock?: number;

  @IsOptional()
  @IsNumber()
  priceAdjustmentPercent?: number;
}
