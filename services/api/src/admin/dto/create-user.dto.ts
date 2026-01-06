import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
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

  @IsEnum(UserRole)
  role: UserRole;

  // Required only when creating seller roles
  @IsOptional()
  @IsString()
  storeName?: string;

  // Optional: assign a permission-role (custom role) for fine-grained permissions
  @IsOptional()
  @IsString()
  permissionRoleName?: string;
}


