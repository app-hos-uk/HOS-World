import { IsUUID, IsDateString, IsOptional, IsString, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePayoutDto {
  @ApiProperty({ description: 'Influencer UUID' })
  @IsUUID()
  influencerId: string;

  @ApiProperty({ description: 'Payout period start (ISO 8601)' })
  @IsDateString()
  periodStart: string;

  @ApiProperty({ description: 'Payout period end (ISO 8601)' })
  @IsDateString()
  periodEnd: string;

  @ApiPropertyOptional({ description: 'Specific commission IDs to include' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  commissionIds?: string[];

  @ApiPropertyOptional({ description: 'Admin notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
