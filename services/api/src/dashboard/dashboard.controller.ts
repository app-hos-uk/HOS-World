import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @Roles('SELLER', 'B2C_SELLER', 'WHOLESALER', 'ADMIN')
  async getStats(
    @Request() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<ApiResponse<any>> {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    // Route based on user role
    // ADMIN can access seller dashboard (will show aggregate data or allow selection)
    if (req.user.role === 'WHOLESALER') {
      const stats = await this.dashboardService.getWholesalerDashboard(req.user.id);
      return {
        data: stats,
        message: 'Wholesaler dashboard retrieved successfully',
      };
    } else if (req.user.role === 'B2C_SELLER') {
      const stats = await this.dashboardService.getB2CSellerDashboard(req.user.id);
      return {
        data: stats,
        message: 'B2C Seller dashboard retrieved successfully',
      };
    } else if (req.user.role === 'ADMIN') {
      // Admin accessing seller dashboard - return admin dashboard stats or allow viewing
      // For now, return admin dashboard data when accessing this endpoint
      const stats = await this.dashboardService.getAdminDashboard();
      return {
        data: stats,
        message: 'Admin dashboard retrieved successfully',
      };
    } else {
      const stats = await this.dashboardService.getSellerDashboard(req.user.id, start, end);
      return {
        data: stats,
        message: 'Dashboard statistics retrieved successfully',
      };
    }
  }

  @Get('procurement')
  @Roles('PROCUREMENT', 'ADMIN')
  async getProcurementDashboard(): Promise<ApiResponse<any>> {
    const dashboard = await this.dashboardService.getProcurementDashboard();
    return {
      data: dashboard,
      message: 'Procurement dashboard retrieved successfully',
    };
  }

  @Get('fulfillment')
  @Roles('FULFILLMENT', 'ADMIN')
  async getFulfillmentDashboard(): Promise<ApiResponse<any>> {
    const dashboard = await this.dashboardService.getFulfillmentDashboard();
    return {
      data: dashboard,
      message: 'Fulfillment dashboard retrieved successfully',
    };
  }

  @Get('catalog')
  @Roles('CATALOG', 'ADMIN')
  async getCatalogDashboard(): Promise<ApiResponse<any>> {
    const dashboard = await this.dashboardService.getCatalogDashboard();
    return {
      data: dashboard,
      message: 'Catalog dashboard retrieved successfully',
    };
  }

  @Get('marketing')
  @Roles('MARKETING', 'ADMIN')
  async getMarketingDashboard(): Promise<ApiResponse<any>> {
    const dashboard = await this.dashboardService.getMarketingDashboard();
    return {
      data: dashboard,
      message: 'Marketing dashboard retrieved successfully',
    };
  }

  @Get('finance')
  @Roles('FINANCE', 'ADMIN')
  async getFinanceDashboard(): Promise<ApiResponse<any>> {
    const dashboard = await this.dashboardService.getFinanceDashboard();
    return {
      data: dashboard,
      message: 'Finance dashboard retrieved successfully',
    };
  }

  @Get('admin')
  @Roles('ADMIN')
  async getAdminDashboard(): Promise<ApiResponse<any>> {
    const dashboard = await this.dashboardService.getAdminDashboard();
    return {
      data: dashboard,
      message: 'Admin dashboard retrieved successfully',
    };
  }
}


