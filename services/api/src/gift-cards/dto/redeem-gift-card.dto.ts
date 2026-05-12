import { IsString, IsNumber, IsOptional, Min, MaxLength } from 'class-validator';

export class RedeemGiftCardDto {
  @IsString()
  @MaxLength(64)
  code: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  orderId?: string;
}
