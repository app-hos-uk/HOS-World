import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsObject,
  IsUrl,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/** http(s) only with explicit protocol — matches typical CDN / image hosting URLs */
const CATALOG_HTTP_URL = {
  protocols: ['http', 'https'] as ('http' | 'https')[],
  require_protocol: true,
};

export class CatalogMarketingMaterialDto {
  @IsString()
  @IsNotEmpty()
  type: string;

  @IsUrl(CATALOG_HTTP_URL)
  url: string;
}

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
  @IsUrl(CATALOG_HTTP_URL, { each: true })
  images?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CatalogMarketingMaterialDto)
  marketingMaterials?: CatalogMarketingMaterialDto[];
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
  @IsUrl(CATALOG_HTTP_URL, { each: true })
  images?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CatalogMarketingMaterialDto)
  marketingMaterials?: CatalogMarketingMaterialDto[];
}
