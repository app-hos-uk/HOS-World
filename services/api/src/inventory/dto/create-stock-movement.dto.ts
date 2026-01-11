import { IsString, IsNotEmpty, IsInt, IsEnum, IsOptional } from 'class-validator';

export enum MovementType {
  IN = 'IN',
  OUT = 'OUT',
  ADJUST = 'ADJUST',
  RESERVE = 'RESERVE',
  RELEASE = 'RELEASE',
}

export class CreateStockMovementDto {
  @IsString()
  @IsNotEmpty()
  inventoryLocationId: string;

  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsInt()
  quantity: number; // Positive for IN, negative for OUT/ADJUST

  @IsEnum(MovementType)
  movementType: MovementType;

  @IsOptional()
  @IsString()
  referenceType?: string; // 'ORDER', 'TRANSFER', 'ADJUSTMENT', etc.

  @IsOptional()
  @IsString()
  referenceId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
