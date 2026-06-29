import { IsString, IsUUID, IsNumber, IsOptional, IsIn, IsObject, Min } from 'class-validator';

export class CreateTransactionDto {
  @IsIn(['PAYMENT', 'PAYOUT', 'REFUND', 'FEE', 'ADJUSTMENT'])
  type: 'PAYMENT' | 'PAYOUT' | 'REFUND' | 'FEE' | 'ADJUSTMENT';

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsUUID()
  sellerId?: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsUUID()
  orderId?: string;

  @IsOptional()
  @IsUUID()
  settlementId?: string;

  @IsOptional()
  @IsUUID()
  returnId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsIn(['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED'])
  status?: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
}
