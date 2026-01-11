import { IsString, IsInt, IsOptional, IsBoolean, IsNumber, IsObject } from 'class-validator';

export class ShippingConditionDto {
  @IsOptional()
  @IsObject()
  weightRange?: {
    min?: number; // in kg
    max?: number; // in kg
  };

  @IsOptional()
  @IsObject()
  cartValueRange?: {
    min?: number;
    max?: number;
  };

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;
}

export class CreateShippingRuleDto {
  @IsString()
  shippingMethodId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsObject()
  conditions?: ShippingConditionDto;

  @IsNumber()
  rate: number;

  @IsOptional()
  @IsNumber()
  freeShippingThreshold?: number;

  @IsOptional()
  @IsInt()
  estimatedDays?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
