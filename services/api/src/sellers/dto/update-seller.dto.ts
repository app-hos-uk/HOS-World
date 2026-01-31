import {
  IsOptional,
  IsString,
  IsEnum,
  IsBoolean,
  IsUrl,
  IsEmail,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SellerType, LogisticsOption } from '@prisma/client';

class WarehouseAddressDto {
  @IsOptional()
  @IsString()
  street?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsString()
  country?: string;
}

export class UpdateSellerDto {
  @IsOptional()
  @IsString()
  storeName?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  logo?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsEnum(SellerType)
  sellerType?: SellerType;

  @IsOptional()
  @IsEnum(LogisticsOption)
  logisticsOption?: LogisticsOption;

  @IsOptional()
  @IsString()
  customDomain?: string;

  @IsOptional()
  @IsString()
  subDomain?: string;

  @IsOptional()
  @IsBoolean()
  domainPackagePurchased?: boolean;

  // Business compliance fields
  @IsOptional()
  @IsString()
  legalBusinessName?: string;

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  vatNumber?: string;

  // Bank details
  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  accountHolder?: string;

  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsOptional()
  @IsString()
  sortCode?: string;

  // Operations contact
  @IsOptional()
  @IsString()
  opsContactName?: string;

  @IsOptional()
  @IsEmail()
  opsContactEmail?: string;

  @IsOptional()
  @IsString()
  opsContactPhone?: string;

  // Warehouse address
  @IsOptional()
  @ValidateNested()
  @Type(() => WarehouseAddressDto)
  warehouseAddress?: WarehouseAddressDto;
}
