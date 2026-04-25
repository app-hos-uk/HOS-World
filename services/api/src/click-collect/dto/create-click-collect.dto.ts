import { IsISO8601, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateClickCollectDto {
  @IsUUID()
  orderId!: string;

  @IsUUID()
  storeId!: string;

  @IsOptional()
  @IsISO8601()
  estimatedReady?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
