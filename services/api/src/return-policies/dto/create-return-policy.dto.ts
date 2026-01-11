import { IsString, IsOptional, IsBoolean, IsInt, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateReturnPolicyDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  sellerId?: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsBoolean()
  isReturnable?: boolean;

  @IsInt()
  @Type(() => Number)
  returnWindowDays: number;

  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresInspection?: boolean;

  @IsOptional()
  @IsString()
  refundMethod?: string; // 'ORIGINAL_PAYMENT', 'STORE_CREDIT', 'EXCHANGE'

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  restockingFee?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
