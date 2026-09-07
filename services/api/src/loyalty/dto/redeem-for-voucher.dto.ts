import { IsInt, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class RedeemForVoucherDto {
  @IsInt()
  @Min(1)
  points!: number;

  @IsUUID()
  storeId!: string;

  /** Prefer membershipId when known from a prior lookup. */
  @IsOptional()
  @IsUUID()
  membershipId?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  cardNumber?: string;

  /**
   * Retry a FAILED voucher: reuses the same row + clientId (never mints a new idempotency key).
   */
  @IsOptional()
  @IsUUID()
  voucherId?: string;

  /**
   * Terminal-supplied replay key, e.g. `${terminalId}:${tillSaleRef}`. Required for new
   * redemptions so a double-tap cannot burn points twice; may also be sent as the
   * `Idempotency-Key` header. Not needed when retrying via voucherId.
   */
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  idempotencyKey?: string;

  /** Till terminal identifier (required for staff-assisted redemption). */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  terminalId?: string;

  /** OTP code from customer (required for staff-assisted redemption). */
  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  otpCode?: string;

  /**
   * Merchandise total on the till (gift cards excluded). Required to redeem the
   * Welcome Reward — must be at least the campaign threshold.
   */
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  purchaseSubtotal?: number;
}
