import { IsOptional, IsString, IsEnum, IsDateString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { OrderStatus, PaymentStatus } from '@prisma/client';

const emptyToUndefined = ({ value }: { value: unknown }) =>
  value === '' || value === null ? undefined : value;

export class UpdateOrderDto {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  trackingCode?: string;

  /** Shipping carrier name (e.g. USPS, FedEx, DHL). */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  carrier?: string;

  /** Public tracking page URL for the shipment. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  trackingUrl?: string;

  /** Estimated delivery date (ISO 8601). */
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsDateString()
  estimatedDeliveryAt?: string;
}
