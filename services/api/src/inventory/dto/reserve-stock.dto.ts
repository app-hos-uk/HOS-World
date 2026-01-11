import { IsString, IsInt, IsOptional, IsDateString } from 'class-validator';

export class ReserveStockDto {
  @IsString()
  inventoryLocationId: string;

  @IsInt()
  quantity: number;

  @IsOptional()
  @IsString()
  orderId?: string;

  @IsOptional()
  @IsString()
  cartId?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string; // If not provided, defaults to 24 hours from now
}
