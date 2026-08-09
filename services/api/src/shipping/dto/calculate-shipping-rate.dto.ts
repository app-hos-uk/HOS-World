import { Type } from 'class-transformer';
import { IsNumber, IsObject, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class ShippingDestinationDto {
  @IsString()
  country: string;

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

export class CalculateShippingRateDto {
  @IsNumber()
  @Min(0)
  cartValue: number;

  @IsNumber()
  @Min(0)
  weight: number;

  // Required: reading country off an absent destination is what made this endpoint answer 500.
  @IsObject()
  @ValidateNested()
  @Type(() => ShippingDestinationDto)
  destination: ShippingDestinationDto;

  @IsOptional()
  @IsString()
  sellerId?: string;
}
