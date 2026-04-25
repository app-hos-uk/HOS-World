import { IsOptional, IsUUID } from 'class-validator';

export class ApplyCartLoyaltyDto {
  @IsUUID()
  optionId: string;

  @IsOptional()
  @IsUUID()
  cartId?: string;
}
