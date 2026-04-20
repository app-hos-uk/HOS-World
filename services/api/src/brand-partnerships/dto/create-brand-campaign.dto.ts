import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateBrandCampaignDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  description?: string;

  @IsString()
  @MaxLength(32)
  type!: string;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  multiplier?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  bonusPoints?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPointsPerUser?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  totalPointsBudget?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetFandoms?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetBrands?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetCategoryIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetProductIds?: string[];

  @IsOptional()
  @IsString()
  segmentId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minTierLevel?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  regionCodes?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  featuredProductIds?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  exclusiveTierLevel?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  journeySlug?: string;

  @IsOptional()
  @IsBoolean()
  notifyOnStart?: boolean;
}
