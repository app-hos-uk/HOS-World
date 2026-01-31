import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  Request,
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
import { DiscrepanciesService } from './discrepancies.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('discrepancies')
@ApiBearerAuth('JWT-auth')
@Controller('discrepancies')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class DiscrepanciesController {
  constructor(private readonly discrepanciesService: DiscrepanciesService) {}

  @Post()
  @ApiOperation({
    summary: 'Create discrepancy (Admin only)',
    description: 'Creates a new discrepancy record for tracking issues. Admin access required.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['type', 'description'],
      properties: {
        type: {
          type: 'string',
          enum: ['INVENTORY', 'PRICING', 'SETTLEMENT', 'ORDER_FULFILLMENT'],
        },
        sellerId: { type: 'string', format: 'uuid' },
        orderId: { type: 'string', format: 'uuid' },
        productId: { type: 'string', format: 'uuid' },
        settlementId: { type: 'string', format: 'uuid' },
        severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
        expectedValue: { type: 'object' },
        actualValue: { type: 'object' },
        description: { type: 'string' },
      },
    },
  })
  @SwaggerApiResponse({ status: 201, description: 'Discrepancy created successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async createDiscrepancy(
    @Body()
    body: {
      type: 'INVENTORY' | 'PRICING' | 'SETTLEMENT' | 'ORDER_FULFILLMENT';
      sellerId?: string;
      orderId?: string;
      productId?: string;
      settlementId?: string;
      severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      expectedValue?: any;
      actualValue?: any;
      description: string;
    },
  ): Promise<ApiResponse<any>> {
    const discrepancy = await this.discrepanciesService.createDiscrepancy(body);
    return {
      data: discrepancy,
      message: 'Discrepancy created successfully',
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Get all discrepancies (Admin only)',
    description: 'Retrieves all discrepancies with filtering options. Admin access required.',
  })
  @ApiQuery({ name: 'sellerId', required: false, type: String, description: 'Filter by seller ID' })
  @ApiQuery({
    name: 'type',
    required: false,
    type: String,
    description: 'Filter by discrepancy type',
  })
  @ApiQuery({ name: 'severity', required: false, type: String, description: 'Filter by severity' })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Filter by status' })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Start date (ISO format)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'End date (ISO format)',
  })
  @ApiQuery({ name: 'page', required: false, type: String, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: String, description: 'Items per page' })
  @SwaggerApiResponse({ status: 200, description: 'Discrepancies retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async getDiscrepancies(
    @Query('sellerId') sellerId?: string,
    @Query('type') type?: string,
    @Query('severity') severity?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ApiResponse<any>> {
    const result = await this.discrepanciesService.getDiscrepancies({
      sellerId,
      type: type as any,
      severity: severity as any,
      status: status as any,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return {
      data: result,
      message: 'Discrepancies retrieved successfully',
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get discrepancy by ID (Admin only)',
    description: 'Retrieves a specific discrepancy by ID. Admin access required.',
  })
  @ApiParam({ name: 'id', description: 'Discrepancy UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Discrepancy retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Discrepancy not found' })
  async getDiscrepancyById(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<any>> {
    const discrepancy = await this.discrepanciesService.getDiscrepancyById(id);
    return {
      data: discrepancy,
      message: 'Discrepancy retrieved successfully',
    };
  }

  @Put(':id/resolve')
  @ApiOperation({
    summary: 'Resolve discrepancy (Admin only)',
    description: 'Marks a discrepancy as resolved with a resolution note. Admin access required.',
  })
  @ApiParam({ name: 'id', description: 'Discrepancy UUID', type: String })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['resolution'],
      properties: {
        resolution: { type: 'string', description: 'Resolution description' },
      },
    },
  })
  @SwaggerApiResponse({ status: 200, description: 'Discrepancy resolved successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Discrepancy not found' })
  async resolveDiscrepancy(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { resolution: string },
    @Request() req: any,
  ): Promise<ApiResponse<any>> {
    const discrepancy = await this.discrepanciesService.resolveDiscrepancy(
      id,
      req.user.id,
      body.resolution,
    );
    return {
      data: discrepancy,
      message: 'Discrepancy resolved successfully',
    };
  }

  @Get('seller/:sellerId')
  @ApiOperation({
    summary: 'Get seller discrepancies (Admin only)',
    description:
      'Retrieves all discrepancies for a specific seller with filtering options. Admin access required.',
  })
  @ApiParam({ name: 'sellerId', description: 'Seller UUID', type: String })
  @ApiQuery({
    name: 'type',
    required: false,
    type: String,
    description: 'Filter by discrepancy type',
  })
  @ApiQuery({ name: 'severity', required: false, type: String, description: 'Filter by severity' })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Filter by status' })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Start date (ISO format)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'End date (ISO format)',
  })
  @ApiQuery({ name: 'page', required: false, type: String, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: String, description: 'Items per page' })
  @SwaggerApiResponse({ status: 200, description: 'Seller discrepancies retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Seller not found' })
  async getSellerDiscrepancies(
    @Param('sellerId', ParseUUIDPipe) sellerId: string,
    @Query('type') type?: string,
    @Query('severity') severity?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ApiResponse<any>> {
    const result = await this.discrepanciesService.getSellerDiscrepancies(sellerId, {
      type: type as any,
      severity: severity as any,
      status: status as any,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return {
      data: result,
      message: 'Seller discrepancies retrieved successfully',
    };
  }
}
