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
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { LogisticsService } from './logistics.service';
import { CreateLogisticsPartnerDto, UpdateLogisticsPartnerDto } from './dto/create-logistics-partner.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('logistics')
@ApiBearerAuth('JWT-auth')
@Controller('logistics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class LogisticsController {
  constructor(private readonly logisticsService: LogisticsService) {}

  @Post('partners')
  @ApiOperation({
    summary: 'Create logistics partner (Admin only)',
    description: 'Creates a new logistics partner. Admin access required.',
  })
  @ApiBody({ type: CreateLogisticsPartnerDto })
  @SwaggerApiResponse({ status: 201, description: 'Logistics partner created successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
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
  @ApiOperation({
    summary: 'Get all logistics partners (Admin only)',
    description: 'Retrieves all logistics partners with optional filtering. Admin access required.',
  })
  @ApiQuery({ name: 'activeOnly', required: false, type: String, description: 'Filter by active status (true/false)' })
  @SwaggerApiResponse({ status: 200, description: 'Logistics partners retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
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
  @ApiOperation({
    summary: 'Get logistics partner by ID (Admin only)',
    description: 'Retrieves a specific logistics partner by ID. Admin access required.',
  })
  @ApiParam({ name: 'id', description: 'Partner UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Logistics partner retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Partner not found' })
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
  @ApiOperation({
    summary: 'Update logistics partner (Admin only)',
    description: 'Updates an existing logistics partner. Admin access required.',
  })
  @ApiParam({ name: 'id', description: 'Partner UUID', type: String })
  @ApiBody({ type: UpdateLogisticsPartnerDto })
  @SwaggerApiResponse({ status: 200, description: 'Logistics partner updated successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Partner not found' })
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
  @ApiOperation({
    summary: 'Delete logistics partner (Admin only)',
    description: 'Deletes a logistics partner. Admin access required.',
  })
  @ApiParam({ name: 'id', description: 'Partner UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Logistics partner deleted successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Partner not found' })
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
  @ApiOperation({
    summary: 'Assign partner to shipment (Admin only)',
    description: 'Assigns a logistics partner to a shipment. Admin access required.',
  })
  @ApiParam({ name: 'shipmentId', description: 'Shipment UUID', type: String })
  @ApiParam({ name: 'partnerId', description: 'Partner UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Partner assigned to shipment successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Shipment or partner not found' })
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



