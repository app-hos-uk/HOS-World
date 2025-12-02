import { IsString, IsUUID, IsOptional } from 'class-validator';

export class CreateOrderDto {
  @IsUUID()
  shippingAddressId: string;

  @IsUUID()
  billingAddressId: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;
}


