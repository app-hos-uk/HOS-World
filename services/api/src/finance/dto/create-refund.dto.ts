import { IsString, IsUUID, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateRefundDto {
  @IsUUID()
  returnId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
