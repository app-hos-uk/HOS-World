import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('notifications')
@ApiBearerAuth('JWT-auth')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('admin/failed-jobs')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Get failed notification jobs (admin)',
    description: 'Retrieves paginated list of notifications with status FAILED.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Failed jobs retrieved' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden' })
  async getFailedJobs(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ): Promise<ApiResponse<any>> {
    const result = await this.notificationsService.getFailedNotifications(
      parseInt(page || '1', 10),
      parseInt(limit || '20', 10),
    );
    return {
      data: result,
      message: 'Failed jobs retrieved successfully',
    };
  }

  @Post('admin/failed-jobs/:id/retry')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Retry failed notification (admin)',
    description: 'Re-queues a failed notification and resets its status to PENDING.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Notification retried' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden' })
  @SwaggerApiResponse({ status: 404, description: 'Failed notification not found' })
  async retryFailedJob(@Param('id') id: string): Promise<ApiResponse<any>> {
    const result = await this.notificationsService.retryFailedNotification(id);
    return {
      data: result,
      message: 'Notification retried successfully',
    };
  }

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
  ): Promise<ApiResponse<any>> {
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    const result = await this.notificationsService.getUserNotifications(req.user.id, {
      limit: parsedLimit,
    });
    return {
      data: result,
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
  async markRead(@Request() req: any, @Param('id') id: string): Promise<ApiResponse<any>> {
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
