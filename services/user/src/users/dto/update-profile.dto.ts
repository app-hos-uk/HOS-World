import { IsString, IsOptional, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() avatar?: string;
  @IsOptional() @IsString() themePreference?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() whatsappNumber?: string;
  @IsOptional() @IsString() preferredCommunicationMethod?: string;
  @IsOptional() @IsString() currencyPreference?: string;
  @IsOptional() @IsString() birthday?: string;
  @IsOptional() @IsString() anniversary?: string;
}

export class ChangePasswordDto {
  @IsString() currentPassword: string;
  @IsString() @MinLength(8) newPassword: string;
}
