import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  IsISO8601,
} from 'class-validator';

export class CreateProductCampaignDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsISO8601()
  startsAt!: string;

  @IsISO8601()
  endsAt!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  productIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categoryIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fandomFilter?: string[];

  @IsOptional()
  @IsInt()
  bonusPoints?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minTierLevel?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  regionCodes?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  maxRedemptions?: number;

  /** When true, empty targeting arrays mean the campaign applies to all products (explicit opt-in). */
  @IsOptional()
  @IsBoolean()
  applyToAllProducts?: boolean;
}
