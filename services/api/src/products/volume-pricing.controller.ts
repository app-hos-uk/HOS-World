import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { VolumePricingService } from './volume-pricing.service';
import { CreateVolumePricingDto } from './dto/create-volume-pricing.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('products')
@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SELLER', 'B2C_SELLER')
@ApiBearerAuth('JWT-auth')
export class VolumePricingController {
  constructor(private readonly volumePricingService: VolumePricingService) {}

  @Post(':productId/volume-pricing')
  @ApiOperation({
    summary: 'Create volume pricing tier',
    description: 'Creates a new volume pricing tier for a product based on quantity.',
  })
  @ApiParam({ name: 'productId', description: 'Product UUID', type: String })
  @SwaggerApiResponse({ status: 201, description: 'Volume pricing tier created successfully' })
  async createVolumePricing(
    @Param('productId') productId: string,
    @Body() createDto: Omit<CreateVolumePricingDto, 'productId'>,
  ): Promise<ApiResponse<any>> {
    const result = await this.volumePricingService.createVolumePricing({
      ...createDto,
      productId,
    });
    return {
      data: result,
      message: 'Volume pricing tier created successfully',
    };
  }

  @Get(':productId/volume-pricing')
  @ApiOperation({
    summary: 'Get volume pricing tiers',
    description: 'Retrieves all volume pricing tiers for a product.',
  })
  @ApiParam({ name: 'productId', description: 'Product UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Volume pricing tiers retrieved successfully' })
  async getVolumePricing(@Param('productId') productId: string): Promise<ApiResponse<any[]>> {
    const tiers = await this.volumePricingService.getVolumePricingByProduct(productId);
    return {
      data: tiers,
      message: 'Volume pricing tiers retrieved successfully',
    };
  }

  @Post(':productId/volume-pricing/calculate')
  @Roles('ADMIN', 'SELLER', 'B2C_SELLER', 'CUSTOMER', 'WHOLESALER')
  @ApiOperation({
    summary: 'Calculate price with volume pricing',
    description:
      'Calculates the price for a product based on quantity, applying volume pricing discounts.',
  })
  @ApiParam({ name: 'productId', description: 'Product UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Price calculated successfully' })
  async calculatePrice(
    @Param('productId') productId: string,
    @Body() body: { quantity: number },
  ): Promise<ApiResponse<any>> {
    const result = await this.volumePricingService.calculatePrice(productId, body.quantity);
    return {
      data: result,
      message: 'Price calculated successfully',
    };
  }

  @Put('volume-pricing/:id')
  @ApiOperation({
    summary: 'Update volume pricing tier',
    description: 'Updates an existing volume pricing tier.',
  })
  @ApiParam({ name: 'id', description: 'Volume pricing tier UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Volume pricing tier updated successfully' })
  async updateVolumePricing(
    @Param('id') id: string,
    @Body() updateDto: Partial<CreateVolumePricingDto>,
  ): Promise<ApiResponse<any>> {
    const result = await this.volumePricingService.updateVolumePricing(id, updateDto);
    return {
      data: result,
      message: 'Volume pricing tier updated successfully',
    };
  }

  @Delete('volume-pricing/:id')
  @ApiOperation({
    summary: 'Delete volume pricing tier',
    description: 'Deletes a volume pricing tier.',
  })
  @ApiParam({ name: 'id', description: 'Volume pricing tier UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Volume pricing tier deleted successfully' })
  async deleteVolumePricing(@Param('id') id: string): Promise<ApiResponse<void>> {
    await this.volumePricingService.deleteVolumePricing(id);
    return {
      data: null,
      message: 'Volume pricing tier deleted successfully',
    };
  }
}
