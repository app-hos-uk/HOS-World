import { IsArray, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class InviteEventDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tierIds?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  minTierLevel?: number;

  @IsOptional()
  @IsString()
  fandomId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5000)
  limit?: number;

  @IsOptional()
  @IsUUID()
  segmentId?: string;
}
