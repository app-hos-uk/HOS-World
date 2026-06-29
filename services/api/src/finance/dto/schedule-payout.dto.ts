import { IsString, IsUUID, IsNumber, IsOptional, Min, IsDateString } from 'class-validator';

export class SchedulePayoutDto {
  @IsUUID()
  sellerId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsDateString()
  scheduledDate?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
