import { IsOptional, IsString, IsNumber, Min, Max, IsObject } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateInfluencerDto {
  @ApiPropertyOptional({ description: 'Display name for storefront' })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional({ description: 'Bio/description' })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ description: 'Profile image URL' })
  @IsOptional()
  @IsString()
  profileImage?: string;

  @ApiPropertyOptional({ description: 'Banner image URL' })
  @IsOptional()
  @IsString()
  bannerImage?: string;

  @ApiPropertyOptional({
    description: 'Social media links',
    example: { instagram: 'username', youtube: 'channel' },
  })
  @IsOptional()
  @IsObject()
  socialLinks?: Record<string, string>;
}

export class UpdateInfluencerCommissionDto {
  @ApiPropertyOptional({ description: 'Base commission rate (0-1)', example: 0.1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  baseCommissionRate?: number;

  @ApiPropertyOptional({
    description: 'Category-specific commission rates',
    example: { 'cat-uuid-1': 0.15 },
  })
  @IsOptional()
  @IsObject()
  categoryCommissions?: Record<string, number>;

  @ApiPropertyOptional({ description: 'Cookie duration in days' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  cookieDuration?: number;
}

export class CreateProductLinkDto {
  @ApiPropertyOptional({ description: 'Product ID to create link for' })
  @IsString()
  productId: string;

  @ApiPropertyOptional({ description: 'Custom URL slug (optional)' })
  @IsOptional()
  @IsString()
  customSlug?: string;
}
