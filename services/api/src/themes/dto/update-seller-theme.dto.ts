import { IsOptional, IsObject, IsString, ValidateIf, IsNotEmpty } from 'class-validator';
import { IsHttpPublicUrl } from '../../common/validators/http-public-url.validator';

export class UpdateSellerThemeDto {
  @IsOptional()
  @ValidateIf((_, v) => v !== undefined && v !== null && String(v).trim() !== '')
  @IsString()
  @IsNotEmpty()
  themeId?: string;

  @IsOptional()
  @ValidateIf((_, v) => typeof v === 'string' && v.trim().length > 0)
  @IsHttpPublicUrl()
  customLogoUrl?: string;

  @IsOptional()
  @ValidateIf((_, v) => typeof v === 'string' && v.trim().length > 0)
  @IsHttpPublicUrl()
  customFaviconUrl?: string;

  @IsOptional()
  @IsObject()
  customColors?: Record<string, string>;
}
