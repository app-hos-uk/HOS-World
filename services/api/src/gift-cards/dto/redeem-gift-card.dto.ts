import { IsString, IsNumber, IsOptional, Min } from 'class-validator';

export class RedeemGiftCardDto {
  @IsString()
  code: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  orderId?: string;
}

