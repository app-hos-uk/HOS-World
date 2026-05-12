import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsEmail,
  IsInt,
  Matches,
  ValidateIf,
} from 'class-validator';

export class CreateFulfillmentCenterDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^(?=.*\p{L})[\p{L}\p{N}\s'.\-&,()/]+$/u, {
    message: 'Name must include at least one letter and cannot be numbers-only',
  })
  name: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^(?=.*\p{L})[\p{L}\p{N}\s'.\-]+$/u, {
    message: 'City must include at least one letter and cannot be numbers-only',
  })
  city: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^(?=.*\p{L})[\p{L}\p{N}\s'.\-]+$/u, {
    message: 'Country must include at least one letter and cannot be numbers-only',
  })
  country: string;

  @IsOptional()
  @IsString()
  @ValidateIf((_, v) => v != null && String(v).trim() !== '')
  @Matches(/^(?!^[A-Za-z\s-]+$)[A-Za-z0-9](?:[A-Za-z0-9 -]*[A-Za-z0-9])?$/i, {
    message:
      'Postal code cannot be letters only; use a valid format (e.g. include digits where applicable)',
  })
  postalCode?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @ValidateIf((_, v) => v != null && String(v).trim() !== '')
  @Matches(/^\+?(?=.*\d)[()[\]\d\s.-]{8,24}$/, {
    message: 'Phone must contain digits only (optional + prefix; no letters)',
  })
  contactPhone?: string;

  @IsOptional()
  @IsInt()
  capacity?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateFulfillmentCenterDto {
  @IsOptional()
  @IsString()
  @ValidateIf((_, v) => v != null && String(v).trim() !== '')
  @Matches(/^(?=.*\p{L})[\p{L}\p{N}\s'.\-&,()/]+$/u, {
    message: 'Name must include at least one letter and cannot be numbers-only',
  })
  name?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  @ValidateIf((_, v) => v != null && String(v).trim() !== '')
  @Matches(/^(?=.*\p{L})[\p{L}\p{N}\s'.\-]+$/u, {
    message: 'City must include at least one letter and cannot be numbers-only',
  })
  city?: string;

  @IsOptional()
  @IsString()
  @ValidateIf((_, v) => v != null && String(v).trim() !== '')
  @Matches(/^(?=.*\p{L})[\p{L}\p{N}\s'.\-]+$/u, {
    message: 'Country must include at least one letter and cannot be numbers-only',
  })
  country?: string;

  @IsOptional()
  @IsString()
  @ValidateIf((_, v) => v != null && String(v).trim() !== '')
  @Matches(/^(?!^[A-Za-z\s-]+$)[A-Za-z0-9](?:[A-Za-z0-9 -]*[A-Za-z0-9])?$/i, {
    message:
      'Postal code cannot be letters only; use a valid format (e.g. include digits where applicable)',
  })
  postalCode?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @ValidateIf((_, v) => v != null && String(v).trim() !== '')
  @Matches(/^\+?(?=.*\d)[()[\]\d\s.-]{8,24}$/, {
    message: 'Phone must contain digits only (optional + prefix; no letters)',
  })
  contactPhone?: string;

  @IsOptional()
  @IsInt()
  capacity?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
