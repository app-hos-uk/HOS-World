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
} from '@nestjs/common';
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

@Controller('fulfillment')
export class FulfillmentController {
  constructor(private readonly fulfillmentService: FulfillmentService) {}

  // Fulfillment Center Management
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'FULFILLMENT')
  @Post('centers')
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

