import { IsIn } from 'class-validator';

export class UpdateTransactionStatusDto {
  @IsIn(['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED'])
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
}
