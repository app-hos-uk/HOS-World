import { IsString, IsEnum, IsOptional, IsBoolean } from 'class-validator';
import { CustomerGroupType } from '@prisma/client';

export class CreateCustomerGroupDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(CustomerGroupType)
  type: CustomerGroupType;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
