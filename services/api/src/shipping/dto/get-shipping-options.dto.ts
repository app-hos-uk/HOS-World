import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { ShippingDestinationDto } from './calculate-shipping-rate.dto';

export class ShippingCartItemDto {
  @IsString()
  productId: string;

  @IsNumber()
  @Min(0)
  quantity: number;

  @IsOptional()
  @IsNumber()
  weight?: number;

  // Quoting uses weight and quantity only, but the storefront sends price with every line.
  // Accept it: with forbidNonWhitelisted on, omitting it here would reject live checkout traffic.
  @IsOptional()
  @IsNumber()
  price?: number;
}

export class GetShippingOptionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShippingCartItemDto)
  cartItems: ShippingCartItemDto[];

  @IsNumber()
  @Min(0)
  cartValue: number;

  @IsObject()
  @ValidateNested()
  @Type(() => ShippingDestinationDto)
  destination: ShippingDestinationDto;

  @IsOptional()
  @IsString()
  sellerId?: string;
}
