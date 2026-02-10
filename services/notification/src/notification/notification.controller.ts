import {
  Controller,
  Get,
  Patch,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { GatewayAuthGuard, CurrentUser, AuthUser } from '@hos-marketplace/auth-common';

/**
 * Notification Controller
 *
 * REST endpoints for the notification microservice.
 * When accessed via the gateway, authentication is handled by the
 * GatewayAuthGuard (reads X-User-* headers injected by the gateway).
 */
@ApiTags('notifications')
@ApiBearerAuth('JWT-auth')
@Controller('notifications')
@UseGuards(GatewayAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({
    summary: 'Get user notifications',
    description: 'Retrieves all notifications for the authenticated user.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Notifications retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async getNotifications(@CurrentUser() user: AuthUser) {
    const notifications = await this.notificationService.getUserNotifications(
      user.id,
    );
    return {
      data: notifications,
      message: 'Notifications retrieved successfully',
    };
  }

  @Patch(':id/read')
  @ApiOperation({
    summary: 'Mark notification as read',
    description: 'Marks a specific notification as read.',
  })
  @ApiParam({ name: 'id', description: 'Notification UUID' })
  @SwaggerApiResponse({ status: 200, description: 'Notification marked as read' })
  @SwaggerApiResponse({ status: 404, description: 'Notification not found' })
  async markAsRead(@Param('id', ParseUUIDPipe) id: string) {
    const notification = await this.notificationService.markAsRead(id);
    return {
      data: notification,
      message: 'Notification marked as read',
    };
  }
}
