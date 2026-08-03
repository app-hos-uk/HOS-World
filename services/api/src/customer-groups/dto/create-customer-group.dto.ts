import { IsString, IsEnum, IsOptional, IsBoolean, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { CustomerGroupType } from '@prisma/client';

export class CreateCustomerGroupDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value))
  @IsString()
  @Matches(/^(?=.*\p{L}).+$/u, { message: 'Group name must include at least one letter' })
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
