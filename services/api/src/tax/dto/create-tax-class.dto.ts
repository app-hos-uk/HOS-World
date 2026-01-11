import { IsString, IsOptional } from 'class-validator';

export class CreateTaxClassDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}
