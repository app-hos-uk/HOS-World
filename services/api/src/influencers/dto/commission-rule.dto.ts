import { IsString, IsUUID, IsOptional, IsNumber, IsBoolean, Min, Max } from 'class-validator';

export class CreateCommissionRuleDto {
  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  brandName?: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  commissionRate: number;

  @IsOptional()
  @IsNumber()
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCommissionRuleDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  commissionRate?: number;

  @IsOptional()
  @IsNumber()
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
