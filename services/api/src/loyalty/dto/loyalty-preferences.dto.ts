import { IsBoolean, IsOptional } from 'class-validator';

/** PATCH body: at least one field must be present (enforced in LoyaltyService.updatePreferences). */
export class LoyaltyPreferencesDto {
  @IsOptional()
  @IsBoolean()
  optInEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  optInSms?: boolean;

  @IsOptional()
  @IsBoolean()
  optInWhatsApp?: boolean;

  @IsOptional()
  @IsBoolean()
  optInPush?: boolean;
}
