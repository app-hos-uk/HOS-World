import { IsString, IsOptional, IsEmail, IsEnum, IsDateString, MinLength, Matches } from 'class-validator';

export enum CommunicationMethod {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  WHATSAPP = 'WHATSAPP',
  PHONE = 'PHONE',
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
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
  @IsString()
  whatsappNumber?: string;

  @IsOptional()
  @IsEnum(CommunicationMethod)
  preferredCommunicationMethod?: CommunicationMethod;

  @IsOptional()
  @IsString()
  currencyPreference?: string;

  // Marketing dates (optional for personalized campaigns)
  @IsOptional()
  @IsDateString()
  birthday?: string;

  @IsOptional()
  @IsDateString()
  anniversary?: string;
}

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  newPassword: string;
}
