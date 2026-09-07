import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';
import { ValidateIf } from 'class-validator';

export class RedeemInStoreDto {
  @IsInt()
  @Min(1)
  points!: number;

  /** UUID — pass this OR storeCode, not both. */
  @ValidateIf((o) => !o.storeCode)
  @IsUUID()
  storeId?: string;

  /** Human-readable store code displayed at the till (e.g. HOS-LONDON-01). */
  @ValidateIf((o) => !o.storeId)
  @IsString()
  @MinLength(2)
  @MaxLength(30)
  storeCode?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  idempotencyKey?: string;
}
