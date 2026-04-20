import { IsBoolean, IsOptional } from 'class-validator';

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
