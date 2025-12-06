import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@Controller('finance/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('revenue')
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

