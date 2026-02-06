import { IsOptional } from 'class-validator';

// Use PartialType if available, otherwise define manually
export class UpdateProductDto {
  @IsOptional()
  name?: string;

  @IsOptional()
  description?: string;

  @IsOptional()
  shortDescription?: string;

  @IsOptional()
  sku?: string;

  @IsOptional()
  barcode?: string;

  @IsOptional()
  ean?: string;

  @IsOptional()
  price?: number;

  @IsOptional()
  tradePrice?: number;

  @IsOptional()
  rrp?: number;

  @IsOptional()
  currency?: string;

  @IsOptional()
  taxRate?: number;

  @IsOptional()
  stock?: number;

  @IsOptional()
  images?: Array<{
    url: string;
    alt?: string;
    order?: number;
    type?: string;
  }>;

  @IsOptional()
  variations?: Array<{
    name: string;
    options: Array<{
      value: string;
      priceModifier?: number;
      stock?: number;
      sku?: string;
    }>;
  }>;

  @IsOptional()
  fandom?: string;

  @IsOptional()
  category?: string; // Keep for backward compatibility

  @IsOptional()
  tags?: string[]; // Keep for backward compatibility

  @IsOptional()
  categoryId?: string; // New: taxonomy category ID

  @IsOptional()
  attributes?: Array<{
    attributeId: string;
    attributeValueId?: string;
    textValue?: string;
    numberValue?: number;
    booleanValue?: boolean;
    dateValue?: string;
  }>; // New: product attributes

  @IsOptional()
  tagIds?: string[]; // New: taxonomy tag IDs

  @IsOptional()
  status?: string;
}
