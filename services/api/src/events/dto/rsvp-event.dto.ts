import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class RsvpEventDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5)
  guestCount?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
