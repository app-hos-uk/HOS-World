import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, Length, Matches, IsUUID } from 'class-validator';

export class EnrollLoyaltyDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @Length(2, 2, { message: 'Region code must be exactly 2 characters (ISO 3166-1 alpha-2)' })
  @Matches(/^[A-Z]{2}$/, {
    message: 'Region code must be uppercase ISO format (e.g., US, GB, AE, MY)',
  })
  regionCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  preferredCurrency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  enrollmentChannel?: string;

  /** Optional store UUID so store-scoped SIGNUP_BONUS campaigns can match. */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value))
  @IsUUID('4')
  storeId?: string;

  /** Enchanted Circle (HOS-*) or partner (PARTNER-*) code from /ref/[code], cookie hos_ref, or ?ref= */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  referralCode?: string;
}
