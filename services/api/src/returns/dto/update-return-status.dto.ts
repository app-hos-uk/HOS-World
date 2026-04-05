import { IsString, IsNotEmpty, IsOptional, IsNumber, IsIn, Min } from 'class-validator';

export class UpdateReturnStatusDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['PENDING', 'APPROVED', 'REJECTED', 'PROCESSING', 'COMPLETED', 'REFUNDED'])
  status: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  refundAmount?: number;

  @IsOptional()
  @IsString()
  refundMethod?: string;
}
