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
import { PayoutsService } from './payouts.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('finance')
@ApiBearerAuth('JWT-auth')
@Controller('finance/payouts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class PayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  @Post('schedule')
  @ApiOperation({
    summary: 'Schedule payout (Admin only)',
    description: 'Schedules a payout to a seller. Admin access required.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['sellerId', 'amount'],
      properties: {
        sellerId: { type: 'string', format: 'uuid', description: 'Seller UUID' },
        amount: { type: 'number', description: 'Payout amount' },
        currency: { type: 'string', description: 'Currency code (optional)' },
        paymentMethod: { type: 'string', description: 'Payment method (optional)' },
        scheduledDate: { type: 'string', format: 'date-time', description: 'Scheduled date (ISO format, optional)' },
        description: { type: 'string', description: 'Payout description (optional)' },
      },
    },
  })
  @SwaggerApiResponse({ status: 201, description: 'Payout scheduled successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Seller not found' })
  async schedulePayout(
    @Body()
    body: {
      sellerId: string;
      amount: number;
      currency?: string;
      paymentMethod?: string;
      scheduledDate?: string;
      description?: string;
    },
  ): Promise<ApiResponse<any>> {
    const payout = await this.payoutsService.schedulePayout({
      ...body,
      scheduledDate: body.scheduledDate ? new Date(body.scheduledDate) : undefined,
    });
    return {
      data: payout,
      message: 'Payout scheduled successfully',
    };
  }

  @Put(':id/process')
  @ApiOperation({
    summary: 'Process payout (Admin only)',
    description: 'Processes a scheduled payout. Admin access required.',
  })
  @ApiParam({ name: 'id', description: 'Payout UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Payout processed successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Payout cannot be processed' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Payout not found' })
  async processPayout(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<any>> {
    const payout = await this.payoutsService.processPayout(id);
    return {
      data: payout,
      message: 'Payout processed successfully',
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Get all payouts (Admin only)',
    description: 'Retrieves all payouts with filtering options. Admin access required.',
  })
  @ApiQuery({ name: 'sellerId', required: false, type: String, description: 'Filter by seller ID' })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Filter by payout status' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Start date (ISO format)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'End date (ISO format)' })
  @ApiQuery({ name: 'page', required: false, type: String, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: String, description: 'Items per page' })
  @SwaggerApiResponse({ status: 200, description: 'Payouts retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async getPayouts(
    @Query('sellerId') sellerId?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ApiResponse<any>> {
    const result = await this.payoutsService.getPayouts({
      sellerId,
      status: status as any,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return {
      data: result,
      message: 'Payouts retrieved successfully',
    };
  }

  @Get(':sellerId/history')
  @ApiOperation({
    summary: 'Get seller payout history (Admin only)',
    description: 'Retrieves payout history for a specific seller. Admin access required.',
  })
  @ApiParam({ name: 'sellerId', description: 'Seller UUID', type: String })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Filter by payout status' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Start date (ISO format)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'End date (ISO format)' })
  @ApiQuery({ name: 'page', required: false, type: String, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: String, description: 'Items per page' })
  @SwaggerApiResponse({ status: 200, description: 'Seller payout history retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'Seller not found' })
  async getSellerPayoutHistory(
    @Param('sellerId', ParseUUIDPipe) sellerId: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ApiResponse<any>> {
    const result = await this.payoutsService.getSellerPayoutHistory(sellerId, {
      status: status as any,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return {
      data: result,
      message: 'Seller payout history retrieved successfully',
    };
  }
}

