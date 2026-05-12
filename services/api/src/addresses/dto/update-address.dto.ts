import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  Min,
  Max,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateAddressDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @ValidateIf((_: UpdateAddressDto, v: unknown) => typeof v === 'string' && v.trim().length > 0)
  @IsString()
  @MaxLength(50)
  @Matches(/^[\p{L}\s'.-]+$/u, {
    message: 'First name may only contain letters, spaces, apostrophes, periods, or hyphens',
  })
  firstName?: string;

  @IsOptional()
  @ValidateIf((_: UpdateAddressDto, v: unknown) => typeof v === 'string' && v.trim().length > 0)
  @IsString()
  @MaxLength(50)
  @Matches(/^[\p{L}\s'.-]+$/u, {
    message: 'Last name may only contain letters, spaces, apostrophes, periods, or hyphens',
  })
  lastName?: string;

  @IsOptional()
  @IsString()
  street?: string;

  @IsOptional()
  @ValidateIf((_: UpdateAddressDto, v: unknown) => typeof v === 'string' && v.trim().length > 0)
  @IsString()
  @MaxLength(80)
  @Matches(/^[\p{L}\s'.-]+$/u, {
    message: 'City may only contain letters, spaces, apostrophes, periods, or hyphens',
  })
  city?: string;

  @IsOptional()
  @ValidateIf((_: UpdateAddressDto, v: unknown) => typeof v === 'string' && v.trim().length > 0)
  @IsString()
  @MaxLength(80)
  @Matches(/^[\p{L}\s'.-]+$/u, {
    message: 'State may only contain letters, spaces, apostrophes, periods, or hyphens',
  })
  state?: string;

  @IsOptional()
  @ValidateIf((_: UpdateAddressDto, v: unknown) => typeof v === 'string' && v.trim().length > 0)
  @IsString()
  @MaxLength(16)
  @Matches(/^[\w\d\s-]+$/, {
    message: 'Postal code may only contain letters, digits, spaces, or hyphens',
  })
  postalCode?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @ValidateIf((_: UpdateAddressDto, v: unknown) => typeof v === 'string' && v.trim().length > 0)
  @IsString()
  @MaxLength(32)
  @Matches(/^\+?[\d\s()-]+$/, {
    message: 'Phone may only contain digits, spaces, hyphens, parentheses, and an optional leading +',
  })
  phone?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  @Type(() => Number)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  @Type(() => Number)
  longitude?: number;
}
