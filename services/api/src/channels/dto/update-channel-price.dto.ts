import { IsBoolean, IsOptional, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateChannelPriceDto {
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
