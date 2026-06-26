import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class MarkPaidPayoutDto {
  @ApiPropertyOptional({ description: 'Payment method (e.g. BANK, PAYPAL)' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  paymentMethod?: string;

  @ApiPropertyOptional({ description: 'External payment reference' })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  paymentRef?: string;
}
