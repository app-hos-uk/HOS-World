import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreatePaymentDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  /** Currency is informational only — payable amount is computed server-side from the order. */
  @IsOptional()
  @IsString()
  currency?: string;
}
