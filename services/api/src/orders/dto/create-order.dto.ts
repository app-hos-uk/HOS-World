import { IsString, IsUUID, IsOptional, IsNumber, Min, MaxLength } from 'class-validator';

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

  /**
   * Client-generated idempotency key for safe retries. Strongly recommended —
   * without one, server-generated keys cannot protect against network retries.
   * Use a UUID or `${userId}-${cartId}-${timestamp}` pattern.
   */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyKey?: string;
}
