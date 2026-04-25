import { IsInt, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class AdminLoyaltyAdjustDto {
  @IsUUID()
  userId: string;

  @IsInt()
  pointsDelta: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
