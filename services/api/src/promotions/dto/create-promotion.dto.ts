import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsInt,
  IsNumber,
  IsDateString,
  IsObject,
  IsArray,
  ValidateNested,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PromotionType, PromotionStatus } from '@prisma/client';

export class PromotionConditionDto {
  @IsOptional()
  @IsString()
  @IsIn(['MIN_ORDER_AMOUNT', 'MIN_QUANTITY', 'NONE'])
  requirementType?: 'MIN_ORDER_AMOUNT' | 'MIN_QUANTITY' | 'NONE';

  @IsOptional()
  @IsString()
  @IsIn(['ALL', 'SPECIFIC_PRODUCTS', 'SPECIFIC_CATEGORIES'])
  eligibilityType?: 'ALL' | 'SPECIFIC_PRODUCTS' | 'SPECIFIC_CATEGORIES';

  @IsOptional()
  @IsObject()
  cartValue?: {
    min?: number;
    max?: number;
  };

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  productIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categoryIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  collectionIds?: string[];

  @IsOptional()
  @IsString()
  customerGroupId?: string;

  @IsOptional()
  @IsInt()
  minQuantity?: number;
}

export class PromotionActionDto {
  @IsEnum(PromotionType)
  type: PromotionType;

  @IsOptional()
  @IsNumber()
  percentage?: number; // For percentage discounts (allows decimals, e.g., 10.5%)

  @IsOptional()
  @IsNumber()
  fixedAmount?: number; // For fixed discounts (allows decimals, e.g., 10.50)

  @IsOptional()
  @IsInt()
  buyQuantity?: number; // For Buy X Get Y

  @IsOptional()
  @IsInt()
  getQuantity?: number; // For Buy X Get Y

  @IsOptional()
  @IsBoolean()
  freeShipping?: boolean; // For free shipping
}

export class CreatePromotionDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(PromotionType)
  type: PromotionType;

  @IsOptional()
  @IsEnum(PromotionStatus)
  status?: PromotionStatus;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ValidateNested()
  @Type(() => PromotionConditionDto)
  conditions: PromotionConditionDto;

  @ValidateNested()
  @Type(() => PromotionActionDto)
  actions: PromotionActionDto;

  @IsOptional()
  @IsBoolean()
  isStackable?: boolean;

  @IsOptional()
  @IsInt()
  usageLimit?: number;

  @IsOptional()
  @IsInt()
  userUsageLimit?: number;

  @IsOptional()
  @IsString()
  sellerId?: string;
}
