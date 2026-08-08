import { IsInt, IsOptional, IsString, IsUUID, Length, Matches, Min } from 'class-validator';

export class RedeemPointsDto {
  @IsInt()
  @Min(1)
  points: number;

  @IsString()
  channel: string;

  @IsOptional()
  @IsUUID()
  optionId?: string;

  @IsOptional()
  @IsUUID()
  storeId?: string;

  /**
   * Client-generated key that makes a retried redeem return the original
   * redemption instead of burning the points a second time.
   */
  @IsOptional()
  @IsString()
  @Length(8, 128)
  @Matches(/^[A-Za-z0-9._:-]+$/, {
    message: 'idempotencyKey may only contain letters, numbers and . _ : -',
  })
  idempotencyKey?: string;
}
