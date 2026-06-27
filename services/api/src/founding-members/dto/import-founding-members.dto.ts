import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ImportFoundingMemberRowDto {
  @ApiProperty({ example: 'John' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ example: 'US' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  country?: string;

  @ApiPropertyOptional({ example: ['Harry Potter', 'Marvel'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fandoms?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  otherFranchises?: string;

  @ApiPropertyOptional({ example: 'external_import' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  source?: string;

  @ApiPropertyOptional({ example: '$100-$500' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  spendBracket?: string;

  @ApiPropertyOptional({ description: 'Original registration date from external source' })
  @IsOptional()
  @IsISO8601()
  registeredAt?: string;
}

export class ImportFoundingMembersDto {
  @ApiProperty({ type: [ImportFoundingMemberRowDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportFoundingMemberRowDto)
  @ArrayMaxSize(5000)
  members: ImportFoundingMemberRowDto[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  skipDuplicates?: boolean;

  @ApiPropertyOptional({
    default: false,
    description: 'Send welcome confirmation email to newly imported members',
  })
  @IsOptional()
  @IsBoolean()
  sendConfirmationEmail?: boolean;

  @ApiPropertyOptional({
    description: 'Default source label applied when row source is empty',
    example: 'manual_import',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  defaultSource?: string;
}
