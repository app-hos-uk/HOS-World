import { IsString, IsOptional, IsBoolean, IsArray } from 'class-validator';

export class TaxZoneCountryDto {
  @IsString()
  country: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;
}

export class CreateTaxZoneDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  countries: TaxZoneCountryDto[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
