import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GatewayAuthGuard, RolesGuard, Roles } from '@hos-marketplace/auth-common';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@Controller('analytics')
@UseGuards(GatewayAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard') getDashboard() { return this.analyticsService.getDashboard(); }
  @Get('timeline') getTimeline(@Query('days') days?: string) { return this.analyticsService.getActivityTimeline(days ? parseInt(days) : 30); }
}
