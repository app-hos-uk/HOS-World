import { IsString, IsOptional, IsEmail, IsEnum } from 'class-validator';

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
}

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  newPassword: string;
}


