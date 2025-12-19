import { IsEmail, IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateSellerDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsOptional()
  @IsString()
  storeName?: string;

  @IsOptional()
  @IsString()
  country?: string;
}

