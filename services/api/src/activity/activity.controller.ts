import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ActivityService } from './activity.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('activity')
@Controller('activity')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('logs')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get activity logs (Admin only)',
    description: 'Retrieves activity logs with filtering options. Admin access required.',
  })
  @ApiQuery({ name: 'userId', required: false, type: String, description: 'Filter by user ID' })
  @ApiQuery({ name: 'sellerId', required: false, type: String, description: 'Filter by seller ID' })
  @ApiQuery({ name: 'action', required: false, type: String, description: 'Filter by action type' })
  @ApiQuery({ name: 'entityType', required: false, type: String, description: 'Filter by entity type' })
  @ApiQuery({ name: 'entityId', required: false, type: String, description: 'Filter by entity ID' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Start date (ISO format)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'End date (ISO format)' })
  @ApiQuery({ name: 'page', required: false, type: String, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: String, description: 'Items per page' })
  @SwaggerApiResponse({ status: 200, description: 'Activity logs retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async getLogs(
    @Query('userId') userId?: string,
    @Query('sellerId') sellerId?: string,
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ApiResponse<any>> {
    const result = await this.activityService.getLogs({
      userId,
      sellerId,
      action,
      entityType,
      entityId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return {
      data: result,
      message: 'Activity logs retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SELLER', 'WHOLESALER', 'B2C_SELLER')
  @Get('logs/:sellerId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get seller activity logs',
    description: 'Retrieves activity logs for a specific seller. Sellers can only view their own logs, admins can view any seller\'s logs.',
  })
  @ApiParam({ name: 'sellerId', description: 'Seller UUID', type: String })
  @ApiQuery({ name: 'action', required: false, type: String, description: 'Filter by action type' })
  @ApiQuery({ name: 'entityType', required: false, type: String, description: 'Filter by entity type' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Start date (ISO format)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'End date (ISO format)' })
  @ApiQuery({ name: 'page', required: false, type: String, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: String, description: 'Items per page' })
  @SwaggerApiResponse({ status: 200, description: 'Seller activity logs retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Cannot access this seller\'s logs' })
  @SwaggerApiResponse({ status: 404, description: 'Seller not found' })
  async getSellerLogs(
    @Param('sellerId', ParseUUIDPipe) sellerId: string,
    @Request() req: any,
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ApiResponse<any>> {
    // Check if user has access to this seller's logs
    if (req.user.role !== 'ADMIN') {
      // For sellers, only allow viewing their own logs
      const userSeller = await this.activityService['prisma'].seller.findUnique({
        where: { userId: req.user.id },
      });
      if (!userSeller || userSeller.id !== sellerId) {
        throw new Error('Unauthorized');
      }
    }

    const result = await this.activityService.getSellerLogs(sellerId, {
      action,
      entityType,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return {
      data: result,
      message: 'Seller activity logs retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('logs/export')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Export activity logs (Admin only)',
    description: 'Exports activity logs as a downloadable file. Admin access required.',
  })
  @ApiQuery({ name: 'userId', required: false, type: String, description: 'Filter by user ID' })
  @ApiQuery({ name: 'sellerId', required: false, type: String, description: 'Filter by seller ID' })
  @ApiQuery({ name: 'action', required: false, type: String, description: 'Filter by action type' })
  @ApiQuery({ name: 'entityType', required: false, type: String, description: 'Filter by entity type' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Start date (ISO format)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'End date (ISO format)' })
  @SwaggerApiResponse({ status: 200, description: 'Activity logs exported successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async exportLogs(
    @Query('userId') userId?: string,
    @Query('sellerId') sellerId?: string,
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<ApiResponse<any[]>> {
    const logs = await this.activityService.exportLogs({
      userId,
      sellerId,
      action,
      entityType,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
    return {
      data: logs,
      message: 'Activity logs exported successfully',
    };
  }
}

