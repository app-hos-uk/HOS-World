import { IsOptional, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { InfluencerStatus, InfluencerTier } from '@prisma/client';
import { UpdateInfluencerDto } from './update-influencer.dto';

export class AdminUpdateInfluencerDto extends UpdateInfluencerDto {
  @ApiPropertyOptional({ enum: InfluencerStatus })
  @IsOptional()
  @IsEnum(InfluencerStatus)
  status?: InfluencerStatus;

  @ApiPropertyOptional({ enum: InfluencerTier })
  @IsOptional()
  @IsEnum(InfluencerTier)
  tier?: InfluencerTier;
}
