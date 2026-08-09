import { Type } from 'class-transformer';
import { IsNumber, IsObject, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class TaxLocationDto {
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

export class CalculateTaxDto {
  @IsNumber()
  @Min(0)
  amount: number;

  @IsString()
  taxClassId: string;

  // Required: reading country off an absent location is what made this endpoint answer 500.
  @IsObject()
  @ValidateNested()
  @Type(() => TaxLocationDto)
  location: TaxLocationDto;
}
