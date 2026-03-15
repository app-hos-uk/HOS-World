import { IsNumber, IsOptional, IsBoolean, IsInt, IsString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateVendorProductDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Type(() => Number)
  vendorPrice?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  costPrice?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  vendorStock?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;

  @IsOptional()
  @IsBoolean()
  allowBackorder?: boolean;

  @IsOptional()
  @IsString()
  fulfillmentMethod?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  leadTimeDays?: number;
}
