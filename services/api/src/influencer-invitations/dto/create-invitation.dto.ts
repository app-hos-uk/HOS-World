import { IsEmail, IsOptional, IsNumber, Min, Max, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateInfluencerInvitationDto {
  @ApiProperty({ description: 'Email address to send invitation to' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ description: 'Custom message for the invitation' })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({ description: 'Pre-configured base commission rate (0-1)', example: 0.1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  baseCommissionRate?: number;
}
