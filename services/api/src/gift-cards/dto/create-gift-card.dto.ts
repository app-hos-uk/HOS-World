import { IsEnum, IsNumber, IsString, IsOptional, IsEmail, Min } from 'class-validator';

export enum GiftCardType {
  DIGITAL = 'digital',
  PHYSICAL = 'physical',
}

export class CreateGiftCardDto {
  @IsEnum(GiftCardType)
  type: GiftCardType;

  @IsNumber()
  @Min(1)
  amount: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsEmail()
  issuedToEmail?: string;

  @IsOptional()
  @IsString()
  issuedToName?: string;

  @IsOptional()
  @IsString()
  expiresAt?: string; // ISO date string

  @IsOptional()
  @IsString()
  message?: string;
}

