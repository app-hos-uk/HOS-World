import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreatePartnerLinkDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Matches(/^PARTNER-[A-Z0-9][A-Z0-9_-]{2,62}$/i, {
    message: 'Code must match PARTNER-… format (e.g. PARTNER-HILTON-NYC-A7F2)',
  })
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  targetUrl?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  utmSource!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  utmMedium?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  utmCampaign?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  utmContent?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  utmTerm?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  signupBonusPoints?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(10)
  pointsMultiplier?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  multiplierDays?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  couponCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountFixedAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxRedemptions?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
