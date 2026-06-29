import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewCancellationDto {
  @IsBoolean()
  approved: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
