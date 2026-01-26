import { IsEmail, IsEnum, IsOptional, IsString, MinLength, Matches, IsIn } from 'class-validator';
import { UserRole } from '@prisma/client';

export class CreateAdminUserDto {
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

  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/, { message: 'Phone must be a valid E.164 format' })
  phone?: string;

  @IsEnum(UserRole)
  role: UserRole;

  // Admin specific: assign a permission-role (custom role) for fine-grained permissions
  @IsOptional()
  @IsString()
  permissionRoleName?: string;

  // Seller/Wholesaler specific
  @IsOptional()
  @IsString()
  storeName?: string;

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  vatNumber?: string;

  // Wholesaler specific
  @IsOptional()
  @IsString()
  @IsIn(['RETAIL', 'DISTRIBUTOR', 'RESELLER'], { message: 'Business type must be RETAIL, DISTRIBUTOR, or RESELLER' })
  businessType?: string;

  // Team member specific
  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  employeeId?: string;
}


