import { IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateSegmentDto {
  // Name character rules are enforced on create + the admin edit form (validateNameLike).
  // Keep update DTO permissive so legacy segment names outside the new character set
  // can still be saved when editing rules/description without renaming.
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsObject()
  rules?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  refreshCron?: string | null;
}
