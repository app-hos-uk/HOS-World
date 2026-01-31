import { IsString, IsOptional, IsEnum, IsNotEmpty } from 'class-validator';
import { ShipmentStatus } from '@prisma/client';

export class VerifyShipmentDto {
  @IsEnum(ShipmentStatus)
  @IsNotEmpty()
  status: ShipmentStatus;

  @IsOptional()
  @IsString()
  verificationNotes?: string;

  @IsOptional()
  @IsString()
  trackingNumber?: string;
}

export class CreateShipmentDto {
  @IsString()
  @IsNotEmpty()
  submissionId: string;

  @IsString()
  @IsNotEmpty()
  fulfillmentCenterId: string;

  @IsOptional()
  @IsString()
  trackingNumber?: string;
}
