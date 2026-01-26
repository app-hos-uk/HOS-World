import { Controller, Get, UseGuards, Request } from '@nestjs/common';
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
  async getNotifications(@Request() req: any): Promise<ApiResponse<any[]>> {
    const notifications = await this.notificationsService.getUserNotifications(req.user.id);
    return {
      data: notifications,
      message: 'Notifications retrieved successfully',
    };
  }
}


