import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsArray,
  IsObject,
  MaxLength,
} from 'class-validator';

export class CreateJourneyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  slug: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsArray()
  steps: unknown[];

  @IsOptional()
  @IsString()
  triggerEvent?: string;

  @IsOptional()
  @IsObject()
  triggerConditions?: object;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  regionCodes?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  channelCodes?: string[];

  @IsOptional()
  @IsString()
  segmentId?: string | null;
}

export class UpdateJourneyDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  steps?: unknown[];

  @IsOptional()
  @IsString()
  triggerEvent?: string;

  @IsOptional()
  @IsObject()
  triggerConditions?: object;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  regionCodes?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  channelCodes?: string[];

  @IsOptional()
  @IsString()
  segmentId?: string | null;
}
