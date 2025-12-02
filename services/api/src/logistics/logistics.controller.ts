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
  ParseUUIDPipe,
} from '@nestjs/common';
import { LogisticsService } from './logistics.service';
import { CreateLogisticsPartnerDto, UpdateLogisticsPartnerDto } from './dto/create-logistics-partner.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@Controller('logistics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class LogisticsController {
  constructor(private readonly logisticsService: LogisticsService) {}

  @Post('partners')
  async createPartner(
    @Body() createDto: CreateLogisticsPartnerDto,
  ): Promise<ApiResponse<any>> {
    const partner = await this.logisticsService.createPartner(createDto);
    return {
      data: partner,
      message: 'Logistics partner created successfully',
    };
  }

  @Get('partners')
  async findAllPartners(
    @Query('activeOnly') activeOnly?: string,
  ): Promise<ApiResponse<any[]>> {
    const partners = await this.logisticsService.findAllPartners(
      activeOnly === 'true',
    );
    return {
      data: partners,
      message: 'Logistics partners retrieved successfully',
    };
  }

  @Get('partners/:id')
  async findOnePartner(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<any>> {
    const partner = await this.logisticsService.findOnePartner(id);
    return {
      data: partner,
      message: 'Logistics partner retrieved successfully',
    };
  }

  @Put('partners/:id')
  async updatePartner(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateLogisticsPartnerDto,
  ): Promise<ApiResponse<any>> {
    const partner = await this.logisticsService.updatePartner(id, updateDto);
    return {
      data: partner,
      message: 'Logistics partner updated successfully',
    };
  }

  @Delete('partners/:id')
  async deletePartner(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<{ message: string }>> {
    await this.logisticsService.deletePartner(id);
    return {
      data: { message: 'Logistics partner deleted successfully' },
      message: 'Logistics partner deleted',
    };
  }

  @Post('shipments/:shipmentId/assign-partner/:partnerId')
  async assignPartnerToShipment(
    @Param('shipmentId', ParseUUIDPipe) shipmentId: string,
    @Param('partnerId', ParseUUIDPipe) partnerId: string,
  ): Promise<ApiResponse<any>> {
    const shipment = await this.logisticsService.assignPartnerToShipment(
      shipmentId,
      partnerId,
    );
    return {
      data: shipment,
      message: 'Partner assigned to shipment successfully',
    };
  }
}

