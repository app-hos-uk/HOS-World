import {
  IsOptional,
  IsString,
  IsNumber,
  Min,
  Max,
  IsObject,
  IsUrl,
  ValidateIf,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

@ValidatorConstraint({ name: 'categoryCommissionRates', async: false })
class CategoryCommissionRatesConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value == null) return true;
    if (typeof value !== 'object' || Array.isArray(value)) return false;
    for (const rate of Object.values(value as Record<string, unknown>)) {
      if (typeof rate !== 'number' || rate < 0 || rate > 1) return false;
    }
    return true;
  }

  defaultMessage(): string {
    return 'Each category commission rate must be a number between 0 and 1';
  }
}

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
  @ValidateIf((_, v) => v != null && String(v).trim() !== '')
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  profileImage?: string;

  @ApiPropertyOptional({ description: 'Banner image URL' })
  @IsOptional()
  @ValidateIf((_, v) => v != null && String(v).trim() !== '')
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
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
  @Validate(CategoryCommissionRatesConstraint)
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
