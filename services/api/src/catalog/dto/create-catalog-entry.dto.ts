import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsObject,
  IsUrl,
  IsEnum,
} from 'class-validator';

export class CreateCatalogEntryDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @IsOptional()
  @IsObject()
  specs?: any;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsArray()
  marketingMaterials?: Array<{ type: string; url: string }>;
}

export class UpdateCatalogEntryDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @IsOptional()
  @IsObject()
  specs?: any;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsArray()
  marketingMaterials?: Array<{ type: string; url: string }>;
}
