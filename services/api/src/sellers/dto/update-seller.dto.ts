import {
  IsOptional,
  IsString,
  IsEnum,
  IsBoolean,
  IsEmail,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SellerType, LogisticsOption } from '@prisma/client';
import {
  OptionalLabelRequiresLetters,
  OptionalOperationsPhone,
  OptionalPostalCodeMixed,
} from '../../common/validators/seller-profile-fields.validator';

class WarehouseAddressDto {
  @IsOptional()
  @IsString()
  street?: string;

  @IsOptional()
  @IsString()
  @OptionalLabelRequiresLetters()
  city?: string;

  @IsOptional()
  @IsString()
  @OptionalLabelRequiresLetters()
  state?: string;

  @IsOptional()
  @IsString()
  @OptionalPostalCodeMixed()
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
  @OptionalLabelRequiresLetters()
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
  @OptionalLabelRequiresLetters()
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
  @OptionalLabelRequiresLetters()
  bankName?: string;

  @IsOptional()
  @IsString()
  @OptionalLabelRequiresLetters()
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
  @OptionalLabelRequiresLetters()
  opsContactName?: string;

  @IsOptional()
  @IsEmail()
  opsContactEmail?: string;

  @IsOptional()
  @IsString()
  @OptionalOperationsPhone()
  opsContactPhone?: string;

  // Warehouse address
  @IsOptional()
  @ValidateNested()
  @Type(() => WarehouseAddressDto)
  warehouseAddress?: WarehouseAddressDto;
}
