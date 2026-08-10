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
  @MinLength(3)
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
  /**
   * Full card number, required to redeem. Only returned for exact-identifier
   * lookups (card / email / phone) so a broad name search cannot harvest cards
   * or redeem against a guessed match.
   */
  cardNumber: string | null;
  /** Always-safe display form, e.g. "****1F2A". */
  maskedCardNumber: string | null;
  tierName: string | null;
  currentBalance: number;
};
