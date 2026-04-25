import { IsBoolean, IsInt, IsObject, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreatePosConnectionDto {
  @IsUUID()
  storeId: string;

  @IsString()
  provider: string;

  /** Plain credentials object; stored encrypted server-side. */
  @IsObject()
  credentials: Record<string, unknown>;

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
  @IsInt()
  @Min(5)
  syncIntervalMinutes?: number;
}
