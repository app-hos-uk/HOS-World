import { IsString, IsNotEmpty, IsOptional, IsNumber, IsIn, Min } from 'class-validator';

export class UpdateReturnStatusDto {
  @IsString()
  @IsNotEmpty()
  @IsIn([
    'PENDING',
    'APPROVED',
    'REJECTED',
    'PROCESSING',
    'AWAITING_CUSTOMER_RETURN',
    'ITEM_RECEIVED',
    'REFUND_PENDING',
    'COMPLETED',
    'CANCELLED',
  ])
  status: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  refundAmount?: number;

  @IsOptional()
  @IsString()
  refundMethod?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
