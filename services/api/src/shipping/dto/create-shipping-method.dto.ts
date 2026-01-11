import { IsString, IsEnum, IsOptional, IsBoolean } from 'class-validator';
import { ShippingMethodType } from '@prisma/client';

export class CreateShippingMethodDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(ShippingMethodType)
  type: ShippingMethodType;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  sellerId?: string;
}
