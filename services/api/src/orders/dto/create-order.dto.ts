import { IsString, IsUUID, IsOptional, IsNumber, Min } from 'class-validator';

export class CreateOrderDto {
  @IsUUID()
  shippingAddressId: string;

  @IsUUID()
  billingAddressId: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  referralCode?: string;

  @IsOptional()
  @IsString()
  visitorId?: string;

  @IsOptional()
  @IsString()
  shippingMethodId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  shippingCost?: number;
}
