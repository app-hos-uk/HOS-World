import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class AdminLoyaltyAdjustDto {
  @IsUUID()
  userId: string;

  @Type(() => Number)
  @IsInt()
  @Min(-1_000_000)
  @Max(1_000_000)
  pointsDelta: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
