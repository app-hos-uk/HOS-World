import {
  IsDateString,
  IsEmail,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export const PARTNER_TYPES = ['EXTERNAL', 'BRAND_PARTNER'] as const;
export type PartnerType = (typeof PARTNER_TYPES)[number];

export const PARTNER_STATUSES = ['ACTIVE', 'PAUSED', 'EXPIRED', 'ARCHIVED'] as const;
export type PartnerStatus = (typeof PARTNER_STATUSES)[number];

export class CreatePartnerDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @IsIn(PARTNER_TYPES)
  type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  contactName?: string;

  @IsOptional()
  @ValidateIf((_, v) => typeof v === 'string' && v.trim().length > 0)
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @ValidateIf((_, v) => typeof v === 'string' && v.trim().length > 0)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true }, { message: 'logoUrl must be a valid http(s) URL' })
  @MaxLength(2048)
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  brandPartnershipId?: string;

  @IsOptional()
  @IsDateString()
  contractStart?: string;

  @IsOptional()
  @IsDateString()
  contractEnd?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
