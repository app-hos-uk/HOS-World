import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';

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
}
