import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
Version,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { FulfillmentService } from './fulfillment.service';
import {
  CreateFulfillmentCenterDto,
  UpdateFulfillmentCenterDto,
} from './dto/create-fulfillment-center.dto';
import { VerifyShipmentDto, CreateShipmentDto } from './dto/verify-shipment.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';
import { ShipmentStatus } from '@prisma/client';

@ApiTags('fulfillment')
@Version('1')
@Controller('fulfillment')
export class FulfillmentController {
  constructor(private readonly fulfillmentService: FulfillmentService) {}

  // Fulfillment Center Management
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'FULFILLMENT')
  @Post('centers')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create fulfillment center (Admin/Fulfillment only)',
    description: 'Creates a new fulfillment center. Admin or Fulfillment access required.',
  })
  @ApiBody({ type: CreateFulfillmentCenterDto })
  @SwaggerApiResponse({ status: 201, description: 'Fulfillment center created successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin/Fulfillment access required' })
  async createFulfillmentCenter(
    @Body() createDto: CreateFulfillmentCenterDto,
  ): Promise<ApiResponse<any>> {
    const center = await this.fulfillmentService.createFulfillmentCenter(createDto);
    return {
      data: center,
      message: 'Fulfillment center created successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'FULFILLMENT', 'PROCUREMENT')
  @Get('centers')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get all fulfillment centers',
    description: 'Retrieves all fulfillment centers with optional filtering. Admin/Fulfillment/Procurement access required.',
  })
  @ApiQuery({ name: 'activeOnly', required: false, type: String, description: 'Filter by active status (true/false)' })
  @SwaggerApiResponse({ status: 200, description: 'Fulfillment centers retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  async findAllFulfillmentCenters(
    @Query('activeOnly') activeOnly?: string,
  ): Promise<ApiResponse<any[]>> {
    const centers = await this.fulfillmentService.findAllFulfillmentCenters(
      activeOnly === 'true',
    );
    return {
      data: centers,
      message: 'Fulfillment centers retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'FULFILLMENT', 'PROCUREMENT')
  @Get('centers/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get fulfillment center by ID',
    description: 'Retrieves a specific fulfillment center by ID. Admin/Fulfillment/Procurement access required.',
  })
  @ApiParam({ name: 'id', description: 'Fulfillment center UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Fulfillment center retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @SwaggerApiResponse({ status: 404, description: 'Fulfillment center not found' })
  async findOneFulfillmentCenter(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<any>> {
    const center = await this.fulfillmentService.findOneFulfillmentCenter(id);
    return {
      data: center,
      message: 'Fulfillment center retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'FULFILLMENT')
  @Put('centers/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update fulfillment center (Admin/Fulfillment only)',
    description: 'Updates an existing fulfillment center. Admin or Fulfillment access required.',
  })
  @ApiParam({ name: 'id', description: 'Fulfillment center UUID', type: String })
  @ApiBody({ type: UpdateFulfillmentCenterDto })
  @SwaggerApiResponse({ status: 200, description: 'Fulfillment center updated successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin/Fulfillment access required' })
  @SwaggerApiResponse({ status: 404, description: 'Fulfillment center not found' })
  async updateFulfillmentCenter(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateFulfillmentCenterDto,
  ): Promise<ApiResponse<any>> {
    const center = await this.fulfillmentService.updateFulfillmentCenter(id, updateDto);
    return {
      data: center,
      message: 'Fulfillment center updated successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete('centers/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Delete fulfillment center (Admin only)',
    description: 'Deletes a fulfillment center. Admin access required.',
  })
  @ApiParam({ name: 'id', description: 'Fulfillment center UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Fulfillment center deleted successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Fulfillment center not found' })
  async deleteFulfillmentCenter(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<{ message: string }>> {
    const result = await this.fulfillmentService.deleteFulfillmentCenter(id);
    return {
      data: result,
      message: result.message,
    };
  }

  // Shipment Management
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PROCUREMENT', 'ADMIN')
  @Post('shipments')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create shipment (Procurement/Admin only)',
    description: 'Creates a new shipment. Procurement or Admin access required.',
  })
  @ApiBody({ type: CreateShipmentDto })
  @SwaggerApiResponse({ status: 201, description: 'Shipment created successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Procurement/Admin access required' })
  async createShipment(
    @Body() createDto: CreateShipmentDto,
  ): Promise<ApiResponse<any>> {
    const shipment = await this.fulfillmentService.createShipment(createDto);
    return {
      data: shipment,
      message: 'Shipment created successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FULFILLMENT', 'ADMIN', 'PROCUREMENT')
  @Get('shipments')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get all shipments',
    description: 'Retrieves all shipments with optional filtering. Fulfillment/Admin/Procurement access required.',
  })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Filter by shipment status' })
  @ApiQuery({ name: 'fulfillmentCenterId', required: false, type: String, description: 'Filter by fulfillment center ID' })
  @SwaggerApiResponse({ status: 200, description: 'Shipments retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  async findAllShipments(
    @Query('status') status?: ShipmentStatus,
    @Query('fulfillmentCenterId') fulfillmentCenterId?: string,
  ): Promise<ApiResponse<any[]>> {
    const shipments = await this.fulfillmentService.findAllShipments(
      status,
      fulfillmentCenterId,
    );
    return {
      data: shipments,
      message: 'Shipments retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FULFILLMENT', 'ADMIN', 'PROCUREMENT')
  @Get('shipments/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get shipment by ID',
    description: 'Retrieves a specific shipment by ID. Fulfillment/Admin/Procurement access required.',
  })
  @ApiParam({ name: 'id', description: 'Shipment UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Shipment retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @SwaggerApiResponse({ status: 404, description: 'Shipment not found' })
  async findOneShipment(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<any>> {
    const shipment = await this.fulfillmentService.findOneShipment(id);
    return {
      data: shipment,
      message: 'Shipment retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FULFILLMENT', 'ADMIN')
  @Put('shipments/:id/verify')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Verify shipment (Fulfillment/Admin only)',
    description: 'Verifies a shipment upon receipt. Fulfillment or Admin access required.',
  })
  @ApiParam({ name: 'id', description: 'Shipment UUID', type: String })
  @ApiBody({ type: VerifyShipmentDto })
  @SwaggerApiResponse({ status: 200, description: 'Shipment verification updated successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Fulfillment/Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Shipment not found' })
  async verifyShipment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() verifyDto: VerifyShipmentDto,
    @Request() req: any,
  ): Promise<ApiResponse<any>> {
    const shipment = await this.fulfillmentService.verifyShipment(
      id,
      req.user.id,
      verifyDto,
    );
    return {
      data: shipment,
      message: 'Shipment verification updated successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FULFILLMENT', 'ADMIN')
  @Get('dashboard/stats')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get fulfillment dashboard statistics',
    description: 'Retrieves dashboard statistics for fulfillment operations. Fulfillment/Admin access required.',
  })
  @ApiQuery({ name: 'fulfillmentCenterId', required: false, type: String, description: 'Filter by fulfillment center ID' })
  @SwaggerApiResponse({ status: 200, description: 'Dashboard statistics retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Fulfillment/Admin access required' })
  async getDashboardStats(
    @Query('fulfillmentCenterId') fulfillmentCenterId?: string,
  ): Promise<ApiResponse<any>> {
    const stats = await this.fulfillmentService.getDashboardStats(fulfillmentCenterId);
    return {
      data: stats,
      message: 'Dashboard statistics retrieved successfully',
    };
  }
}

