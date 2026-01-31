import { IsString, IsEnum, IsOptional } from 'class-validator';

export enum CustomerThemeMode {
  LIGHT = 'light',
  DARK = 'dark',
  ACCESSIBILITY = 'accessibility',
  AUTO = 'auto',
}

export class UpdateCustomerThemePreferenceDto {
  @IsEnum(CustomerThemeMode)
  @IsOptional()
  themePreference?: CustomerThemeMode;
}
