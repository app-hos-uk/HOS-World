import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsArray,
  IsUUID,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum InfluencerCampaignStatusDto {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
}

export class CreateCampaignDto {
  @ApiProperty({ description: 'Influencer UUID' })
  @IsUUID()
  influencerId: string;

  @ApiProperty({ description: 'Campaign name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Campaign description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Campaign start date (ISO 8601)' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'Campaign end date (ISO 8601)' })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({ description: 'Override commission rate (0-1)', example: 0.15 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  overrideCommissionRate?: number;

  @ApiPropertyOptional({ description: 'Product IDs to scope the campaign' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  productIds?: string[];

  @ApiPropertyOptional({ description: 'Category IDs to scope the campaign' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  categoryIds?: string[];

  @ApiPropertyOptional({ enum: InfluencerCampaignStatusDto })
  @IsOptional()
  @IsEnum(InfluencerCampaignStatusDto)
  status?: InfluencerCampaignStatusDto;
}
