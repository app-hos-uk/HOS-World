import { IsBoolean, IsInt, IsObject, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class UpdatePosConnectionDto {
  @IsOptional()
  @IsUUID()
  storeId?: string;
  @IsOptional()
  @IsObject()
  credentials?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  externalOutletId?: string;

  @IsOptional()
  @IsString()
  externalRegisterId?: string;

  @IsOptional()
  @IsString()
  webhookSecret?: string;

  @IsOptional()
  @IsBoolean()
  autoSyncProducts?: boolean;

  @IsOptional()
  @IsBoolean()
  autoSyncInventory?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(5)
  syncIntervalMinutes?: number;
}
