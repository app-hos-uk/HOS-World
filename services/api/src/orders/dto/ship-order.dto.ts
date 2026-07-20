import { IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ShipOrderDto {
  @ApiPropertyOptional({
    description: 'Shipping provider to use (defaults to shippo or highest-priority active provider)',
    example: 'shippo',
  })
  @IsOptional()
  @IsString()
  provider?: string;

  @ApiPropertyOptional({
    description: 'Shippo rate object ID or service token from a prior rate quote',
  })
  @IsOptional()
  @IsString()
  serviceCode?: string;

  @ApiPropertyOptional({
    description: 'Override origin address ID (fulfillment center / warehouse)',
  })
  @IsOptional()
  @IsUUID()
  fromAddressId?: string;
}

export class GetOrderShippingRatesDto {
  @ApiPropertyOptional({ description: 'Shipping provider (defaults to shippo)' })
  @IsOptional()
  @IsString()
  provider?: string;
}
