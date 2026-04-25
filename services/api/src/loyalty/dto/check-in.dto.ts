import { IsUUID } from 'class-validator';

export class LoyaltyCheckInDto {
  @IsUUID()
  storeId: string;
}
