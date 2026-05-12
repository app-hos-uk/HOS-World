import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsEmail,
  IsNotEmpty,
  Matches,
  ValidateIf,
} from 'class-validator';

export class CreateWarehouseDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^(?=.*\p{L})[\p{L}\p{N}\s'.\-&,()/]+$/u, {
    message: 'Name must include at least one letter and cannot be numbers-only',
  })
  name: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^(?=.*\p{L})[\p{L}\p{N}\s'.\-]+$/u, {
    message: 'City must include at least one letter and cannot be numbers-only',
  })
  city: string;

  @IsOptional()
  @IsString()
  @ValidateIf((_, v) => v != null && String(v).trim() !== '')
  @Matches(/^(?=.*\p{L})[\p{L}\p{N}\s'.\-]+$/u, {
    message: 'State/Region must include at least one letter and cannot be numbers-only',
  })
  state?: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^(?=.*\p{L})[\p{L}\p{N}\s'.\-]+$/u, {
    message: 'Country must include at least one letter and cannot be numbers-only',
  })
  country: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^(?!^[A-Za-z\s-]+$)[A-Za-z0-9](?:[A-Za-z0-9 -]*[A-Za-z0-9])?$/i, {
    message:
      'Postal code cannot be letters only; use a valid format (e.g. include digits where applicable)',
  })
  postalCode: string;

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
  @IsString()
  @ValidateIf((_, v) => v != null && String(v).trim() !== '')
  @Matches(/^(?=.*\p{L})[\p{L}\p{N}\s'.\-]+$/u, {
    message: 'Manager name must include at least one letter and cannot be numbers-only',
  })
  managerName?: string;

  @IsOptional()
  @IsNumber()
  capacity?: number;

  @IsOptional()
  @IsString()
  warehouseType?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateWarehouseDto {
  @IsOptional()
  @IsString()
  @ValidateIf((_, v) => v != null && String(v).trim() !== '')
  @Matches(/^(?=.*\p{L})[\p{L}\p{N}\s'.\-&,()/]+$/u, {
    message: 'Name must include at least one letter and cannot be numbers-only',
  })
  name?: string;

  @IsOptional()
  @IsString()
  code?: string;

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
    message: 'State/Region must include at least one letter and cannot be numbers-only',
  })
  state?: string;

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
  @IsString()
  @ValidateIf((_, v) => v != null && String(v).trim() !== '')
  @Matches(/^(?=.*\p{L})[\p{L}\p{N}\s'.\-]+$/u, {
    message: 'Manager name must include at least one letter and cannot be numbers-only',
  })
  managerName?: string;

  @IsOptional()
  @IsNumber()
  capacity?: number;

  @IsOptional()
  @IsString()
  warehouseType?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
