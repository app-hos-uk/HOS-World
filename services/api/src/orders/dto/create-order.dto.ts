import { IsString, IsUUID, IsOptional, IsNumber, IsBoolean, IsEmail, Min, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class GiftDetailsDto {
  @IsString()
  recipientName: string;

  @IsOptional()
  @IsEmail()
  recipientEmail?: string;

  @IsOptional()
  @IsString()
  recipientPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  giftMessage?: string;

  @IsOptional()
  @IsBoolean()
  giftWrapping?: boolean;

  @IsOptional()
  @IsBoolean()
  hidePrice?: boolean;

  @IsOptional()
  @IsString()
  senderName?: string;
}

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

  @IsOptional()
  @IsBoolean()
  isGift?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => GiftDetailsDto)
  giftDetails?: GiftDetailsDto;

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
