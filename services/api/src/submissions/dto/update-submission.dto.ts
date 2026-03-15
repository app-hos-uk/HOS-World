import { IsOptional, IsString, IsEnum, IsNumber, IsObject } from 'class-validator';
import { ProductSubmissionStatus } from '@prisma/client';

export class UpdateSubmissionDto {
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
  productData?: any;
}

export class AdminUpdateSubmissionDto extends UpdateSubmissionDto {
  @IsOptional()
  @IsEnum(ProductSubmissionStatus)
  status?: ProductSubmissionStatus;
}
