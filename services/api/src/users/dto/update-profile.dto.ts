import {
  IsString,
  IsOptional,
  IsEmail,
  IsEnum,
  IsDateString,
  MinLength,
  MaxLength,
  Matches,
  ValidateIf,
} from 'class-validator';

export enum CommunicationMethod {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  WHATSAPP = 'WHATSAPP',
  PHONE = 'PHONE',
}

export class UpdateProfileDto {
  @IsOptional()
  @ValidateIf((_o: UpdateProfileDto, v: unknown) => typeof v === 'string' && v.trim().length > 0)
  @IsString()
  @MaxLength(50)
  @Matches(/^[\p{L}\s\-'.]+$/u, {
    message: 'First name must contain only letters, spaces, hyphens, or apostrophes',
  })
  firstName?: string;

  @IsOptional()
  @ValidateIf((_o: UpdateProfileDto, v: unknown) => typeof v === 'string' && v.trim().length > 0)
  @IsString()
  @MaxLength(50)
  @Matches(/^[\p{L}\s\-'.]+$/u, {
    message: 'Last name must contain only letters, spaces, hyphens, or apostrophes',
  })
  lastName?: string;

  @IsOptional()
  @ValidateIf((_o: UpdateProfileDto, v: unknown) => typeof v === 'string' && v.trim().length > 0)
  @IsString()
  @MaxLength(32)
  @Matches(/^\+?[\d\s()-]+$/, {
    message:
      'Phone must contain only digits, spaces, hyphens, parentheses, and an optional leading +',
  })
  phone?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsEnum(['light', 'dark', 'accessibility'])
  themePreference?: string;

  // Global Platform Fields
  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @ValidateIf((_o: UpdateProfileDto, v: unknown) => typeof v === 'string' && v.trim().length > 0)
  @IsString()
  @MaxLength(32)
  @Matches(/^\+?[\d\s()-]+$/, {
    message: 'WhatsApp number must contain only digits, spaces, hyphens, parentheses, and an optional leading +',
  })
  whatsappNumber?: string;

  @IsOptional()
  @IsEnum(CommunicationMethod)
  preferredCommunicationMethod?: CommunicationMethod;

  @IsOptional()
  @IsString()
  currencyPreference?: string;

  // Marketing dates (optional for personalized campaigns)
  @IsOptional()
  @ValidateIf((_o: UpdateProfileDto, v: unknown) => typeof v === 'string' && v.trim().length > 0)
  @IsDateString()
  birthday?: string;

  @IsOptional()
  @ValidateIf((_o: UpdateProfileDto, v: unknown) => typeof v === 'string' && v.trim().length > 0)
  @IsDateString()
  anniversary?: string;

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  vatNumber?: string;

  @IsOptional()
  @IsString()
  businessRegNumber?: string;

  @IsOptional()
  @IsString()
  businessType?: string;
}

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  newPassword: string;
}
