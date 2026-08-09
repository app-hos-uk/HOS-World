import { IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class TrackReferralDto {
  // Required: the code is the whole point of the call, and an absent one reached the database
  // as undefined and surfaced as a 500.
  @IsString()
  @IsNotEmpty()
  referralCode: string;

  @IsOptional()
  @IsString()
  visitorId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  landingPage?: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  campaignId?: string;

  // Free-form by nature: utm_source, utm_medium and whatever else the campaign carries.
  @IsOptional()
  @IsObject()
  utmParams?: Record<string, string>;
}
