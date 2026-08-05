import { IsBoolean, IsObject, IsOptional, IsString, Matches } from 'class-validator';

export class CreateSegmentDto {
  @IsString()
  // Keep in sync with apps/web validateNameLike character class.
  @Matches(/^(?=.*\p{L})[\p{L}\p{N}\s.'&\-():,#/"®™]+$/u, {
    message:
      'Name must include a letter and may only contain letters, numbers, spaces, and common punctuation',
  })
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
