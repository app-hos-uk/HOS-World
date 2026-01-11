import { IsString, IsNumber, IsOptional, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTaxRateDto {
  @IsString()
  taxZoneId: string;

  @IsOptional()
  @IsString()
  taxClassId?: string; // Optional - null means default rate for all classes

  @IsNumber()
  @Type(() => Number)
  rate: number; // e.g., 0.20 for 20%

  @IsOptional()
  @IsBoolean()
  isInclusive?: boolean; // Tax-inclusive pricing

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
