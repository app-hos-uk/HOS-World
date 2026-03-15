import {
  IsString,
  IsUUID,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Max,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateVendorProductDto {
  @IsUUID()
  productId: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Type(() => Number)
  vendorPrice: number;

  @IsOptional()
  @IsString()
  vendorCurrency?: string;

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
