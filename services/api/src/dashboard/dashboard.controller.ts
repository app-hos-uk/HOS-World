import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  Version,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('dashboard')
@ApiBearerAuth('JWT-auth')
@Version('1')
@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @Roles('SELLER', 'B2C_SELLER', 'WHOLESALER', 'ADMIN')
  @ApiOperation({
    summary: 'Get dashboard statistics',
    description: 'Retrieves dashboard statistics based on user role. Supports date range filtering.',
  })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Start date (ISO format)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'End date (ISO format)' })
  @SwaggerApiResponse({ status: 200, description: 'Dashboard statistics retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
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
  @ApiOperation({
    summary: 'Get procurement dashboard (Procurement/Admin only)',
    description: 'Retrieves procurement dashboard statistics. Procurement or Admin access required.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Procurement dashboard retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Procurement/Admin access required' })
  async getProcurementDashboard(): Promise<ApiResponse<any>> {
    const dashboard = await this.dashboardService.getProcurementDashboard();
    return {
      data: dashboard,
      message: 'Procurement dashboard retrieved successfully',
    };
  }

  @Get('fulfillment')
  @Roles('FULFILLMENT', 'ADMIN')
  @ApiOperation({
    summary: 'Get fulfillment dashboard (Fulfillment/Admin only)',
    description: 'Retrieves fulfillment dashboard statistics. Fulfillment or Admin access required.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Fulfillment dashboard retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Fulfillment/Admin access required' })
  async getFulfillmentDashboard(): Promise<ApiResponse<any>> {
    const dashboard = await this.dashboardService.getFulfillmentDashboard();
    return {
      data: dashboard,
      message: 'Fulfillment dashboard retrieved successfully',
    };
  }

  @Get('catalog')
  @Roles('CATALOG', 'ADMIN')
  @ApiOperation({
    summary: 'Get catalog dashboard (Catalog/Admin only)',
    description: 'Retrieves catalog dashboard statistics. Catalog or Admin access required.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Catalog dashboard retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Catalog/Admin access required' })
  async getCatalogDashboard(): Promise<ApiResponse<any>> {
    const dashboard = await this.dashboardService.getCatalogDashboard();
    return {
      data: dashboard,
      message: 'Catalog dashboard retrieved successfully',
    };
  }

  @Get('marketing')
  @Roles('MARKETING', 'ADMIN')
  @ApiOperation({
    summary: 'Get marketing dashboard (Marketing/Admin only)',
    description: 'Retrieves marketing dashboard statistics. Marketing or Admin access required.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Marketing dashboard retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Marketing/Admin access required' })
  async getMarketingDashboard(): Promise<ApiResponse<any>> {
    const dashboard = await this.dashboardService.getMarketingDashboard();
    return {
      data: dashboard,
      message: 'Marketing dashboard retrieved successfully',
    };
  }

  @Get('finance')
  @Roles('FINANCE', 'ADMIN')
  @ApiOperation({
    summary: 'Get finance dashboard (Finance/Admin only)',
    description: 'Retrieves finance dashboard statistics. Finance or Admin access required.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Finance dashboard retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Finance/Admin access required' })
  async getFinanceDashboard(): Promise<ApiResponse<any>> {
    const dashboard = await this.dashboardService.getFinanceDashboard();
    return {
      data: dashboard,
      message: 'Finance dashboard retrieved successfully',
    };
  }

  @Get('admin')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Get admin dashboard (Admin only)',
    description: 'Retrieves admin dashboard statistics. Admin access required.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Admin dashboard retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async getAdminDashboard(): Promise<ApiResponse<any>> {
    const dashboard = await this.dashboardService.getAdminDashboard();
    return {
      data: dashboard,
      message: 'Admin dashboard retrieved successfully',
    };
  }
}


