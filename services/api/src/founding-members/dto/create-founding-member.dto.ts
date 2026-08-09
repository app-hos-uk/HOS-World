import {
  IsEmail,
  IsString,
  IsOptional,
  IsArray,
  MinLength,
  MaxLength,
  Matches,
  Length,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Reject numeric-only / symbol-only names; require at least one letter. */
const NAME_WITH_LETTER = /^(?=.*\p{L}).+$/u;

export class CreateFoundingMemberDto {
  @ApiProperty({ example: 'John' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value))
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(NAME_WITH_LETTER, { message: 'First name must include at least one letter' })
  firstName: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const t = value.trim().replace(/\s+/g, ' ');
    return t.length ? t : undefined;
  })
  @IsString()
  @MaxLength(100)
  @Matches(NAME_WITH_LETTER, { message: 'Last name must include at least one letter' })
  lastName?: string;

  @ApiProperty({ example: 'john@example.com' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @ApiPropertyOptional({ example: '+1234567890' })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const t = value.trim();
    return t.length ? t : undefined;
  })
  @IsString()
  @MaxLength(20)
  @Matches(/^(?=.*\d)(?!(?:\D*\d){16})[\d\s+\-().]{1,20}$/, {
    message: 'Phone may only contain digits and + ( ) - . spaces (max 15 digits)',
  })
  phone?: string;

  @ApiPropertyOptional({ example: 'US', description: 'ISO 3166-1 alpha-2 country code' })
  @IsOptional()
  @IsString()
  @Length(2, 2, { message: 'Country code must be exactly 2 characters (ISO 3166-1 alpha-2)' })
  @Matches(/^[A-Z]{2}$/, { message: 'Country code must be uppercase ISO format (e.g., US, GB, AE, MY)' })
  countryCode?: string;

  @ApiPropertyOptional({ example: 'US', deprecated: true })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  country?: string;

  @ApiProperty({ example: ['Harry Potter', 'Marvel', 'Star Wars'] })
  @IsArray()
  @IsString({ each: true })
  fandoms: string[];

  @ApiPropertyOptional({ example: 'Anime, K-Drama' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  otherFranchises?: string;

  @ApiPropertyOptional({ example: 'social_media' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  source?: string;

  @ApiPropertyOptional({ example: '$100-$500' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  spendBracket?: string;
}
