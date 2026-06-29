import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class RequestCancellationDto {
  @IsUUID()
  orderId: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}
