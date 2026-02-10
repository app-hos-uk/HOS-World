import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GatewayAuthGuard, RolesGuard, Roles } from '@hos-marketplace/auth-common';
import { ActivityService } from './activity.service';

@ApiTags('activity')
@Controller('activity')
@UseGuards(GatewayAuthGuard, RolesGuard)
@Roles('ADMIN')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get()
  findAll(@Query('userId') userId?: string, @Query('action') action?: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.activityService.findAll({ userId, action, page: page ? parseInt(page) : undefined, limit: limit ? parseInt(limit) : undefined });
  }
}
