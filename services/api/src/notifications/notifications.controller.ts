import { Controller, Get, Put, Delete, Param, Query, UseGuards, Request } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('notifications')
@ApiBearerAuth('JWT-auth')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get user notifications',
    description: 'Retrieves all notifications for the authenticated user.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Notifications retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async getNotifications(
    @Request() req: any,
    @Query('limit') limit?: string,
  ): Promise<ApiResponse<any[]>> {
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    const notifications = await this.notificationsService.getUserNotifications(
      req.user.id,
      parsedLimit,
    );
    return {
      data: notifications,
      message: 'Notifications retrieved successfully',
    };
  }

  @Put('read-all')
  @ApiOperation({
    summary: 'Mark all notifications as read',
    description: 'Marks all unread notifications as read for the authenticated user.',
  })
  @SwaggerApiResponse({ status: 200, description: 'All notifications marked as read' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async markAllRead(@Request() req: any): Promise<ApiResponse<any>> {
    const result = await this.notificationsService.markAllNotificationsRead(req.user.id);
    return {
      data: result,
      message: 'All notifications marked as read',
    };
  }

  @Put(':id/read')
  @ApiOperation({
    summary: 'Mark notification as read',
    description: 'Marks a specific notification as read.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Notification marked as read' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async markRead(
    @Request() req: any,
    @Param('id') id: string,
  ): Promise<ApiResponse<any>> {
    const result = await this.notificationsService.markNotificationRead(req.user.id, id);
    return {
      data: result,
      message: 'Notification marked as read',
    };
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete notification',
    description: 'Deletes a specific notification for the authenticated user.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Notification deleted' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async deleteNotification(
    @Request() req: any,
    @Param('id') id: string,
  ): Promise<ApiResponse<any>> {
    const result = await this.notificationsService.deleteNotification(req.user.id, id);
    return {
      data: result,
      message: 'Notification deleted',
    };
  }
}
