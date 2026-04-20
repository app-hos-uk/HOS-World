import { IsOptional, IsString, MaxLength } from 'class-validator';

export class EnrollLoyaltyDto {
  @IsOptional()
  @IsString()
  @MaxLength(8)
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
