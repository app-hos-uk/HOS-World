import { IsOptional, IsString, IsNumber, IsEnum, IsBoolean, IsNotEmpty } from 'class-validator';
import { ProductSubmissionStatus } from '@prisma/client';

export class ApproveSubmissionDto {
  @IsOptional()
  @IsNumber()
  selectedQuantity?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class RejectSubmissionDto {
  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class SelectQuantityDto {
  @IsNumber()
  @IsNotEmpty()
  quantity: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
