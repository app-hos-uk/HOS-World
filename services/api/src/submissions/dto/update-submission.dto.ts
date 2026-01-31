import { IsOptional, IsString, IsEnum, IsNumber, IsObject } from 'class-validator';
import { ProductSubmissionStatus } from '@prisma/client';

export class UpdateSubmissionDto {
  @IsOptional()
  @IsEnum(ProductSubmissionStatus)
  status?: ProductSubmissionStatus;

  @IsOptional()
  @IsString()
  procurementNotes?: string;

  @IsOptional()
  @IsString()
  catalogNotes?: string;

  @IsOptional()
  @IsString()
  marketingNotes?: string;

  @IsOptional()
  @IsString()
  financeNotes?: string;

  @IsOptional()
  @IsNumber()
  selectedQuantity?: number;

  @IsOptional()
  @IsObject()
  productData?: any; // For updating raw product data
}
