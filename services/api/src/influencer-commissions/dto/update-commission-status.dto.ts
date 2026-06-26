import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CommissionStatus } from '@prisma/client';

export class UpdateCommissionStatusDto {
  @ApiProperty({ enum: CommissionStatus, description: 'New commission status' })
  @IsEnum(CommissionStatus)
  status: CommissionStatus;

  @ApiPropertyOptional({ description: 'Admin notes' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}
