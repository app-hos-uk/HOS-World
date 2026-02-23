import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('finance')
@ApiBearerAuth('JWT-auth')
@Controller('finance/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('FINANCE', 'ADMIN')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('revenue')
  @ApiOperation({
    summary: 'Get revenue report (Admin only)',
    description:
      'Retrieves revenue report with optional filtering and period grouping. Admin access required.',
  })
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
  @ApiQuery({ name: 'sellerId', required: false, type: String, description: 'Filter by seller ID' })
  @ApiQuery({
    name: 'period',
    required: false,
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'yearly'],
    description: 'Grouping period',
  })
  @SwaggerApiResponse({ status: 200, description: 'Revenue report retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async getRevenueReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('sellerId') sellerId?: string,
    @Query('period') period?: 'daily' | 'weekly' | 'monthly' | 'yearly',
  ): Promise<ApiResponse<any>> {
    const report = await this.reportsService.getRevenueReport({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      sellerId,
      period,
    });
    return {
      data: report,
      message: 'Revenue report retrieved successfully',
    };
  }

  @Get('seller-performance')
  @ApiOperation({
    summary: 'Get seller performance report (Admin only)',
    description: 'Retrieves seller performance metrics report. Admin access required.',
  })
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
  @ApiQuery({ name: 'sellerId', required: false, type: String, description: 'Filter by seller ID' })
  @SwaggerApiResponse({
    status: 200,
    description: 'Seller performance report retrieved successfully',
  })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async getSellerPerformance(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('sellerId') sellerId?: string,
  ): Promise<ApiResponse<any[]>> {
    const performance = await this.reportsService.getSellerPerformance({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      sellerId,
    });
    return {
      data: performance,
      message: 'Seller performance report retrieved successfully',
    };
  }

  @Get('customer-spending')
  @ApiOperation({
    summary: 'Get customer spending report (Admin only)',
    description: 'Retrieves customer spending analysis report. Admin access required.',
  })
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
  @ApiQuery({
    name: 'customerId',
    required: false,
    type: String,
    description: 'Filter by customer ID',
  })
  @SwaggerApiResponse({
    status: 200,
    description: 'Customer spending report retrieved successfully',
  })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async getCustomerSpending(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('customerId') customerId?: string,
  ): Promise<ApiResponse<any[]>> {
    const spending = await this.reportsService.getCustomerSpending({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      customerId,
    });
    return {
      data: spending,
      message: 'Customer spending report retrieved successfully',
    };
  }

  @Get('platform-fees')
  @ApiOperation({
    summary: 'Get platform fees report (Admin only)',
    description: 'Retrieves platform fees report. Admin access required.',
  })
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
  @ApiQuery({ name: 'sellerId', required: false, type: String, description: 'Filter by seller ID' })
  @SwaggerApiResponse({ status: 200, description: 'Platform fees report retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async getPlatformFees(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('sellerId') sellerId?: string,
  ): Promise<ApiResponse<any>> {
    const fees = await this.reportsService.getPlatformFees({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      sellerId,
    });
    return {
      data: fees,
      message: 'Platform fees report retrieved successfully',
    };
  }
}
