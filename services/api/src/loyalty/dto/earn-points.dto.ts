import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class EarnPointsDto {
  @IsInt()
  @Min(1)
  points: number;

  @IsString()
  source: string;

  @IsOptional()
  @IsUUID()
  sourceId?: string;

  @IsOptional()
  @IsString()
  channel?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
