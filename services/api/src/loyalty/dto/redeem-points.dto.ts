import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class RedeemPointsDto {
  @IsInt()
  @Min(1)
  points: number;

  @IsString()
  channel: string;

  @IsOptional()
  @IsUUID()
  optionId?: string;

  @IsOptional()
  @IsUUID()
  storeId?: string;
}
