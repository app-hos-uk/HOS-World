import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ShippingService } from './shipping.service';
import { CreateShippingMethodDto } from './dto/create-shipping-method.dto';
import { CreateShippingRuleDto } from './dto/create-shipping-rule.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';
import type { ShippingOption } from './types/shipping.types';

@ApiTags('shipping')
@Controller('shipping')
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @Post('methods')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SELLER', 'B2C_SELLER')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create shipping method',
    description: 'Creates a new shipping method. Requires ADMIN, SELLER, or B2C_SELLER role.',
  })
  @SwaggerApiResponse({ status: 201, description: 'Shipping method created successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid shipping method data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async createShippingMethod(
    @Body() createDto: CreateShippingMethodDto,
  ): Promise<ApiResponse<any>> {
    const method = await this.shippingService.createShippingMethod(createDto);
    return {
      data: method,
      message: 'Shipping method created successfully',
    };
  }

  @Get('methods')
  @Public()
  @ApiOperation({
    summary: 'Get all shipping methods',
    description: 'Retrieves all active shipping methods. Public endpoint.',
  })
  @ApiQuery({ name: 'sellerId', required: false, description: 'Filter by seller ID' })
  @SwaggerApiResponse({ status: 200, description: 'Shipping methods retrieved successfully' })
  async findAllShippingMethods(@Query('sellerId') sellerId?: string): Promise<ApiResponse<any[]>> {
    const methods = await this.shippingService.findAllShippingMethods(sellerId);
    return {
      data: methods,
      message: 'Shipping methods retrieved successfully',
    };
  }

  @Get('methods/:id')
  @Public()
  @ApiOperation({
    summary: 'Get shipping method by ID',
    description: 'Retrieves a specific shipping method by ID. Public endpoint.',
  })
  @ApiParam({ name: 'id', description: 'Shipping method UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Shipping method retrieved successfully' })
  @SwaggerApiResponse({ status: 404, description: 'Shipping method not found' })
  async findShippingMethodById(@Param('id') id: string): Promise<ApiResponse<any>> {
    const method = await this.shippingService.findShippingMethodById(id);
    return {
      data: method,
      message: 'Shipping method retrieved successfully',
    };
  }

  @Put('methods/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SELLER', 'B2C_SELLER')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update shipping method',
    description: 'Updates an existing shipping method. Requires ADMIN, SELLER, or B2C_SELLER role.',
  })
  @ApiParam({ name: 'id', description: 'Shipping method UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Shipping method updated successfully' })
  @SwaggerApiResponse({ status: 404, description: 'Shipping method not found' })
  async updateShippingMethod(
    @Param('id') id: string,
    @Body() updateDto: Partial<CreateShippingMethodDto>,
  ): Promise<ApiResponse<any>> {
    const method = await this.shippingService.updateShippingMethod(id, updateDto);
    return {
      data: method,
      message: 'Shipping method updated successfully',
    };
  }

  @Post('rules')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SELLER', 'B2C_SELLER')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create shipping rule',
    description:
      'Creates a new shipping rule for a shipping method. Requires ADMIN, SELLER, or B2C_SELLER role.',
  })
  @SwaggerApiResponse({ status: 201, description: 'Shipping rule created successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid shipping rule data' })
  async createShippingRule(@Body() createDto: CreateShippingRuleDto): Promise<ApiResponse<any>> {
    const rule = await this.shippingService.createShippingRule(createDto);
    return {
      data: rule,
      message: 'Shipping rule created successfully',
    };
  }

  @Put('rules/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SELLER', 'B2C_SELLER')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update shipping rule',
    description: 'Updates an existing shipping rule. Requires ADMIN, SELLER, or B2C_SELLER role.',
  })
  @ApiParam({ name: 'id', description: 'Shipping rule UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Shipping rule updated successfully' })
  @SwaggerApiResponse({ status: 404, description: 'Shipping rule not found' })
  async updateShippingRule(
    @Param('id') id: string,
    @Body() updateDto: Partial<CreateShippingRuleDto>,
  ): Promise<ApiResponse<any>> {
    const rule = await this.shippingService.updateShippingRule(id, updateDto);
    return {
      data: rule,
      message: 'Shipping rule updated successfully',
    };
  }

  @Post('calculate')
  @Public()
  @ApiOperation({
    summary: 'Calculate shipping rate',
    description:
      'Calculates shipping rates for given cart value, weight, and destination. Public endpoint.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Shipping rates calculated successfully' })
  async calculateShippingRate(
    @Body()
    body: {
      cartValue: number;
      weight: number;
      destination: {
        country: string;
        state?: string;
        city?: string;
        postalCode?: string;
      };
      sellerId?: string;
    },
  ): Promise<ApiResponse<ShippingOption[]>> {
    const options = await this.shippingService.calculateShippingRate(
      body.weight,
      body.cartValue,
      body.destination,
      body.sellerId,
    );
    return {
      data: options,
      message: 'Shipping rates calculated successfully',
    };
  }

  @Post('options')
  @Public()
  @ApiOperation({
    summary: 'Get shipping options for checkout',
    description:
      'Returns available shipping options for cart items and destination. Public endpoint.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Shipping options retrieved successfully' })
  async getShippingOptions(
    @Body()
    body: {
      cartItems: Array<{
        productId: string;
        quantity: number;
        weight?: number;
      }>;
      cartValue: number;
      destination: {
        country: string;
        state?: string;
        city?: string;
        postalCode?: string;
      };
      sellerId?: string;
    },
  ): Promise<ApiResponse<ShippingOption[]>> {
    const options = await this.shippingService.getShippingOptions(
      body.cartItems,
      body.cartValue,
      body.destination,
      body.sellerId,
    );
    return {
      data: options,
      message: 'Shipping options retrieved successfully',
    };
  }
}
