import { IsString, IsOptional, IsBoolean, IsInt, IsArray, Min } from 'class-validator';

export class UpdateUniverseDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  logo?: string;

  @IsOptional()
  @IsString()
  tag?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  accentColor?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  gradientColors?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
