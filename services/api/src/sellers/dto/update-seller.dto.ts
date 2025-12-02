import { IsOptional, IsString, IsEnum, IsBoolean, IsUrl } from 'class-validator';
import { SellerType, LogisticsOption } from '@prisma/client';

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
}

