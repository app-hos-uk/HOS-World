import { IsString, IsOptional, IsObject } from 'class-validator';

export class UpdateSellerThemeDto {
  @IsOptional()
  @IsString()
  themeId?: string;

  @IsOptional()
  @IsString()
  customLogoUrl?: string;

  @IsOptional()
  @IsString()
  customFaviconUrl?: string;

  @IsOptional()
  @IsObject()
  customColors?: Record<string, string>;
}
