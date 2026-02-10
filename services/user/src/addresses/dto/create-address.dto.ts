import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/swagger';

export class CreateAddressDto {
  @IsOptional() @IsString() label?: string;
  @IsString() @IsNotEmpty() firstName: string;
  @IsString() @IsNotEmpty() lastName: string;
  @IsString() @IsNotEmpty() street: string;
  @IsString() @IsNotEmpty() city: string;
  @IsOptional() @IsString() state?: string;
  @IsString() @IsNotEmpty() postalCode: string;
  @IsString() @IsNotEmpty() country: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
  @IsOptional() @IsNumber() @Min(-90) @Max(90) @Type(() => Number) latitude?: number;
  @IsOptional() @IsNumber() @Min(-180) @Max(180) @Type(() => Number) longitude?: number;
}

export class UpdateAddressDto extends PartialType(CreateAddressDto) {}
