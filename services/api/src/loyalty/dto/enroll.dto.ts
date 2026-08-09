import { IsOptional, IsString, MaxLength, Length, Matches } from 'class-validator';

export class EnrollLoyaltyDto {
  @IsOptional()
  @IsString()
  @Length(2, 2, { message: 'Region code must be exactly 2 characters (ISO 3166-1 alpha-2)' })
  @Matches(/^[A-Z]{2}$/, { message: 'Region code must be uppercase ISO format (e.g., US, GB, AE, MY)' })
  regionCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  preferredCurrency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  enrollmentChannel?: string;

  /** Enchanted Circle referral code from /ref/[code], cookie hos_ref, or ?ref= */
  @IsOptional()
  @IsString()
  @MaxLength(48)
  referralCode?: string;
}
