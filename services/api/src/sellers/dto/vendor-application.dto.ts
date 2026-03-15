import { IsEmail, IsString, IsNotEmpty, IsOptional, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VendorApplicationDto {
  @ApiProperty({ example: 'vendor@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: 'Magic Merch Store' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  storeName: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'US' })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiPropertyOptional({ example: 'New York' })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  legalBusinessName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  companyName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  vatNumber?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  taxId?: string;

  @ApiPropertyOptional({ description: 'Why you want to sell on HoS' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  applicationNotes?: string;
}
