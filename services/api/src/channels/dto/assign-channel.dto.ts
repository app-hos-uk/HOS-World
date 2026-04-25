import { IsBoolean, IsOptional, IsString, IsUUID, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AssignChannelDto {
  @IsUUID()
  productId: string;

  @IsString()
  channelType: string;

  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsString()
  currency: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sellingPrice: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  costPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  compareAtPrice?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
