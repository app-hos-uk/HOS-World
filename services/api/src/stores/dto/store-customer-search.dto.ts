import { IsOptional, IsString, Length, MinLength } from 'class-validator';

export class StoreCustomerSearchDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  cardNumber?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  phone?: string;

  @IsOptional()
  @IsString()
  @Length(4, 4)
  phoneLastFour?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  /** Admin-only: override store scope when acting without an assigned store. */
  @IsOptional()
  @IsString()
  storeId?: string;
}

export type StoreCustomerSearchResult = {
  userId: string;
  firstName: string | null;
  lastInitial: string | null;
  maskedEmail: string | null;
  maskedPhone: string | null;
  cardNumber: string | null;
  tierName: string | null;
  currentBalance: number;
};
