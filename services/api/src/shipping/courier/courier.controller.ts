import { Controller, Post, Get, Body, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { CourierService, ShippingRateRequest, ShippingLabelRequest } from './courier.service';
import { CourierFactoryService } from './courier-factory.service';
import {
  Address,
  PackageDimensions,
  RateRequest,
  ShipmentRequest,
} from './interfaces/courier-provider.interface';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('shipping')
@Controller('shipping/courier')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class CourierController {
  constructor(
    private readonly courierService: CourierService,
    private readonly courierFactory: CourierFactoryService,
  ) {}

  @Get('providers')
  @Public()
  @ApiOperation({
    summary: 'Get available courier providers',
    description: 'Returns list of available courier service providers.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Providers retrieved successfully' })
  async getProviders(): Promise<ApiResponse<string[]>> {
    const factoryProviders = this.courierFactory.getAvailableProviderNames();
    const legacyProviders = this.courierService.getAvailableProviders();
    const providers = [...new Set([...factoryProviders, ...legacyProviders])];
    return {
      data: providers,
      message: 'Providers retrieved successfully',
    };
  }

  @Post('rate/:provider')
  @Roles('ADMIN', 'SELLER', 'B2C_SELLER', 'WHOLESALER', 'CUSTOMER')
  @ApiOperation({
    summary: 'Calculate shipping rate',
    description: 'Calculates shipping rate using a specific courier provider.',
  })
  @ApiParam({ name: 'provider', description: 'Courier provider name', type: String })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['weight', 'dimensions', 'from', 'to'],
      properties: {
        weight: { type: 'number', description: 'Weight in kg' },
        dimensions: {
          type: 'object',
          properties: {
            length: { type: 'number', description: 'Length in cm' },
            width: { type: 'number', description: 'Width in cm' },
            height: { type: 'number', description: 'Height in cm' },
          },
        },
        from: { type: 'object' },
        to: { type: 'object' },
        service: { type: 'string', description: 'Service type (optional)' },
      },
    },
  })
  @SwaggerApiResponse({ status: 200, description: 'Rate calculated successfully' })
  async calculateRate(
    @Param('provider') provider: string,
    @Body() request: ShippingRateRequest,
  ): Promise<ApiResponse<any>> {
    const factoryProvider = this.courierFactory.getProvider(provider);
    if (factoryProvider) {
      const rateRequest = this.toRateRequest(request);
      const rates = await this.courierFactory.getRates(provider, rateRequest);
      return {
        data: rates,
        message: 'Rates calculated successfully',
      };
    }

    const result = await this.courierService.calculateRate(provider, request);
    return {
      data: result,
      message: 'Rate calculated successfully',
    };
  }

  @Post('label/:provider')
  @Roles('ADMIN', 'SELLER', 'B2C_SELLER', 'WHOLESALER')
  @ApiOperation({
    summary: 'Create shipping label',
    description: 'Creates a shipping label using a specific courier provider.',
  })
  @ApiParam({ name: 'provider', description: 'Courier provider name', type: String })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['orderId', 'shipment'],
      properties: {
        orderId: { type: 'string' },
        shipment: { type: 'object' },
      },
    },
  })
  @SwaggerApiResponse({ status: 200, description: 'Label created successfully' })
  async createLabel(
    @Param('provider') provider: string,
    @Body() request: ShippingLabelRequest,
  ): Promise<ApiResponse<any>> {
    const factoryProvider = this.courierFactory.getProvider(provider);
    if (factoryProvider) {
      const shipmentRequest = this.toShipmentRequest(request);
      const result = await this.courierFactory.createShipment(provider, shipmentRequest);
      return {
        data: result,
        message: 'Label created successfully',
      };
    }

    const result = await this.courierService.createLabel(provider, request);
    return {
      data: result,
      message: 'Label created successfully',
    };
  }

  @Get('track/:provider/:trackingNumber')
  @Public()
  @ApiOperation({
    summary: 'Track shipment',
    description: "Tracks a shipment using the courier provider's tracking system.",
  })
  @ApiParam({ name: 'provider', description: 'Courier provider name', type: String })
  @ApiParam({ name: 'trackingNumber', description: 'Tracking number', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Tracking information retrieved successfully' })
  async trackShipment(
    @Param('provider') provider: string,
    @Param('trackingNumber') trackingNumber: string,
    @Query('carrier') carrier?: string,
  ): Promise<ApiResponse<any>> {
    const factoryProvider = this.courierFactory.getProvider(provider);
    if (factoryProvider) {
      const result = await this.courierFactory.trackShipment(
        trackingNumber,
        provider,
        carrier,
      );
      return {
        data: result,
        message: 'Tracking information retrieved successfully',
      };
    }

    const result = await this.courierService.trackShipment(provider, trackingNumber);
    return {
      data: result,
      message: 'Tracking information retrieved successfully',
    };
  }

  @Post('validate-address/:provider')
  @Roles('ADMIN', 'SELLER', 'B2C_SELLER', 'WHOLESALER', 'CUSTOMER')
  @ApiOperation({
    summary: 'Validate address',
    description: "Validates an address using the courier provider's address validation service.",
  })
  @ApiParam({ name: 'provider', description: 'Courier provider name', type: String })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        street1: { type: 'string' },
        street: { type: 'string' },
        city: { type: 'string' },
        state: { type: 'string' },
        postalCode: { type: 'string' },
        country: { type: 'string' },
      },
    },
  })
  @SwaggerApiResponse({ status: 200, description: 'Address validation completed' })
  async validateAddress(
    @Param('provider') provider: string,
    @Body() address: any,
  ): Promise<ApiResponse<{ valid: boolean; normalizedAddress?: any; errors?: string[] }>> {
    const factoryProvider = this.courierFactory.getProvider(provider);
    if (factoryProvider) {
      const normalized = this.toAddress(address);
      const result = await this.courierFactory.validateAddress(normalized, provider);
      return {
        data: {
          valid: result.isValid,
          normalizedAddress: result.normalizedAddress,
          errors: result.errors,
        },
        message: 'Address validation completed',
      };
    }

    const valid = await this.courierService.validateAddress(provider, address);
    return {
      data: { valid },
      message: 'Address validation completed',
    };
  }

  private toRateRequest(request: ShippingRateRequest): RateRequest {
    return {
      from: this.toAddress(request.from),
      to: this.toAddress(request.to),
      packages: [this.toPackage(request.weight, request.dimensions)],
      service: request.service,
    };
  }

  private toShipmentRequest(request: ShippingLabelRequest): ShipmentRequest {
    const shipment = request.shipment;
    return {
      orderId: request.orderId,
      from: this.toAddress(shipment.from),
      to: this.toAddress(shipment.to),
      packages: [this.toPackage(shipment.weight, shipment.dimensions)],
      serviceCode: shipment.service,
      labelFormat: 'PDF',
    };
  }

  private toPackage(
    weight: number,
    dimensions: { length: number; width: number; height: number },
  ): PackageDimensions {
    return {
      length: dimensions.length,
      width: dimensions.width,
      height: dimensions.height,
      weight,
    };
  }

  private toAddress(input: any): Address {
    return {
      name: input.name || 'Recipient',
      company: input.company,
      street1: input.street1 || input.street || '',
      street2: input.street2 || input.addressLine2,
      city: input.city || '',
      state: input.state,
      postalCode: input.postalCode || input.zip || '',
      country: input.country || '',
      phone: input.phone,
      email: input.email,
    };
  }
}
