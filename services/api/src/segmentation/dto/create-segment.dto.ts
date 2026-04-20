import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateSegmentDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsObject()
  rules!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  refreshCron?: string | null;

  @IsOptional()
  @IsBoolean()
  isTemplate?: boolean;

  @IsOptional()
  @IsString()
  templateSlug?: string | null;
}
