import { IsString, IsInt, IsOptional } from 'class-validator';

export class CreateInventoryLocationDto {
  @IsString()
  warehouseId: string;

  @IsString()
  productId: string;

  @IsInt()
  quantity: number;

  @IsOptional()
  @IsInt()
  lowStockThreshold?: number;
}
