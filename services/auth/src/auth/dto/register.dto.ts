import { IsEmail, IsString, MinLength, IsOptional, IsEnum, IsBoolean } from 'class-validator';

export enum RegisterRole {
  CUSTOMER = 'customer',
  SELLER = 'seller',
  WHOLESALER = 'wholesaler',
  B2C_SELLER = 'b2c_seller',
}

export enum SellerType {
  WHOLESALER = 'WHOLESALER',
  B2C_SELLER = 'B2C_SELLER',
}

export enum LogisticsOption {
  HOS_LOGISTICS = 'HOS_LOGISTICS',
  SELLER_OWN = 'SELLER_OWN',
  HOS_PARTNER = 'HOS_PARTNER',
}

export enum CommunicationMethod {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  WHATSAPP = 'WHATSAPP',
  PHONE = 'PHONE',
}

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsEnum(RegisterRole)
  role: RegisterRole;

  @IsOptional()
  @IsString()
  storeName?: string;

  @IsOptional()
  @IsEnum(SellerType)
  sellerType?: SellerType;

  @IsOptional()
  @IsEnum(LogisticsOption)
  logisticsOption?: LogisticsOption;

  @IsString()
  country: string;

  @IsOptional()
  @IsString()
  whatsappNumber?: string;

  @IsEnum(CommunicationMethod)
  preferredCommunicationMethod: CommunicationMethod;

  @IsBoolean()
  gdprConsent: boolean;

  @IsOptional()
  dataProcessingConsent?: Record<string, boolean>;
}
