import { IsString, IsNumber, IsOptional, IsBoolean, IsEnum, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum DiscountType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED = 'FIXED',
}

export class CreateVolumePricingDto {
  @IsString()
  productId: string;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  minQuantity: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  maxQuantity?: number;

  @IsEnum(DiscountType)
  discountType: DiscountType;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  discountValue: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price?: number; // Fixed price at this tier

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
