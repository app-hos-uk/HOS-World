import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class ConfirmPaymentDto {
  @IsString()
  @IsNotEmpty()
  paymentIntentId: string;

  @IsUUID()
  @IsNotEmpty()
  orderId: string;
}
