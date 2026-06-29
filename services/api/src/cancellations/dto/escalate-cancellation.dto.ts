import { IsOptional, IsString, MaxLength } from 'class-validator';

export class EscalateCancellationDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}
