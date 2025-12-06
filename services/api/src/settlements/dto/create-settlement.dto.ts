import { IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { SettlementStatus } from '@prisma/client';

export class CreateSettlementDto {
  @IsString()
  sellerId: string;

  @IsDateString()
  periodStart: string;

  @IsDateString()
  periodEnd: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ProcessSettlementDto {
  @IsEnum(SettlementStatus)
  status: SettlementStatus;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}


