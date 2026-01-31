import { IsNumber, IsNotEmpty, IsOptional, IsEnum, IsString, Min, Max } from 'class-validator';
import { VisibilityLevel } from '@prisma/client';

export class SetPricingDto {
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  basePrice: number;

  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  @Max(1)
  hosMargin: number; // Percentage as decimal (e.g., 0.15 for 15%)

  @IsOptional()
  @IsEnum(VisibilityLevel)
  visibilityLevel?: VisibilityLevel;
}

export class ApprovePricingDto {
  @IsOptional()
  @IsString()
  notes?: string;
}
