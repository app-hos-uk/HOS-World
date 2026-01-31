import { Controller, Post, Get, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { CourierService, ShippingRateRequest, ShippingLabelRequest } from './courier.service';
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
  constructor(private readonly courierService: CourierService) {}

  @Get('providers')
  @Public()
  @ApiOperation({
    summary: 'Get available courier providers',
    description: 'Returns list of available courier service providers.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Providers retrieved successfully' })
  async getProviders(): Promise<ApiResponse<string[]>> {
    const providers = this.courierService.getAvailableProviders();
    return {
      data: providers,
      message: 'Providers retrieved successfully',
    };
  }

  @Post('rate/:provider')
  @Roles('ADMIN', 'SELLER', 'B2C_SELLER', 'CUSTOMER')
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
        from: {
          type: 'object',
          properties: {
            country: { type: 'string' },
            postalCode: { type: 'string' },
            city: { type: 'string' },
          },
        },
        to: {
          type: 'object',
          properties: {
            country: { type: 'string' },
            postalCode: { type: 'string' },
            city: { type: 'string' },
          },
        },
        service: { type: 'string', description: 'Service type (optional)' },
      },
    },
  })
  @SwaggerApiResponse({ status: 200, description: 'Rate calculated successfully' })
  async calculateRate(
    @Param('provider') provider: string,
    @Body() request: ShippingRateRequest,
  ): Promise<ApiResponse<any>> {
    const result = await this.courierService.calculateRate(provider, request);
    return {
      data: result,
      message: 'Rate calculated successfully',
    };
  }

  @Post('label/:provider')
  @Roles('ADMIN', 'SELLER', 'B2C_SELLER')
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
        shipment: {
          type: 'object',
          properties: {
            from: { type: 'object' },
            to: { type: 'object' },
            weight: { type: 'number' },
            dimensions: { type: 'object' },
            service: { type: 'string' },
          },
        },
      },
    },
  })
  @SwaggerApiResponse({ status: 200, description: 'Label created successfully' })
  async createLabel(
    @Param('provider') provider: string,
    @Body() request: ShippingLabelRequest,
  ): Promise<ApiResponse<any>> {
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
  ): Promise<ApiResponse<any>> {
    const result = await this.courierService.trackShipment(provider, trackingNumber);
    return {
      data: result,
      message: 'Tracking information retrieved successfully',
    };
  }

  @Post('validate-address/:provider')
  @Roles('ADMIN', 'SELLER', 'B2C_SELLER', 'CUSTOMER')
  @ApiOperation({
    summary: 'Validate address',
    description: "Validates an address using the courier provider's address validation service.",
  })
  @ApiParam({ name: 'provider', description: 'Courier provider name', type: String })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
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
  ): Promise<ApiResponse<{ valid: boolean; normalizedAddress?: any }>> {
    const valid = await this.courierService.validateAddress(provider, address);
    return {
      data: { valid },
      message: 'Address validation completed',
    };
  }
}
