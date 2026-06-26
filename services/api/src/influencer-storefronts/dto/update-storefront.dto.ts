import { IsOptional, IsString, IsBoolean, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateStorefrontDto {
  @ApiPropertyOptional({ example: '#7C3AED' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  primaryColor?: string;

  @ApiPropertyOptional({ example: '#F3E8FF' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  secondaryColor?: string;

  @ApiPropertyOptional({ example: '#FFFFFF' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  backgroundColor?: string;

  @ApiPropertyOptional({ example: '#1F2937' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  textColor?: string;

  @ApiPropertyOptional({ example: 'Inter' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  fontFamily?: string;

  @ApiPropertyOptional({ example: 'grid' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  layoutType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showBanner?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showBio?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showSocialLinks?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(256)
  metaTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(512)
  metaDescription?: string;
}
