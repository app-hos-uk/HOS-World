import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ApiResponse } from '@hos-marketplace/shared-types';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { LoyaltyAnalyticsService } from './loyalty-analytics.service';

@ApiTags('admin-loyalty-analytics')
@ApiBearerAuth('JWT-auth')
@Controller('admin/loyalty-analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class LoyaltyAnalyticsController {
  constructor(private analytics: LoyaltyAnalyticsService) {}

  @Get('health')
  @ApiOperation({ summary: 'Programme health KPIs' })
  async health(): Promise<ApiResponse<unknown>> {
    const data = await this.analytics.getProgrammeHealth();
    return { data, message: 'OK' };
  }

  @Get('snapshots')
  @ApiOperation({ summary: 'Snapshot timeline' })
  async snapshots(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<ApiResponse<unknown>> {
    const s = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 86_400_000);
    const e = endDate ? new Date(endDate) : new Date();
    const data = await this.analytics.getSnapshotTimeline(s, e);
    return { data, message: 'OK' };
  }

  @Get('clv/distribution')
  @ApiOperation({ summary: 'CLV bucket distribution' })
  async clvDistribution(): Promise<ApiResponse<unknown>> {
    const data = await this.analytics.getClvDistribution();
    return { data, message: 'OK' };
  }

  @Get('clv/top')
  @ApiOperation({ summary: 'Top members by CLV' })
  async clvTop(@Query('limit') limit?: string): Promise<ApiResponse<unknown>> {
    const data = await this.analytics.getTopMembersByClv(limit ? parseInt(limit, 10) : undefined);
    return { data, message: 'OK' };
  }

  @Get('clv/churn')
  @ApiOperation({ summary: 'Churn risk report' })
  async churn(): Promise<ApiResponse<unknown>> {
    const data = await this.analytics.getChurnRiskReport();
    return { data, message: 'OK' };
  }

  @Get('attribution')
  @ApiOperation({ summary: 'Campaign attribution report' })
  async attribution(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('type') type?: string,
    @Query('limit') limit?: string,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.analytics.getCampaignAttributionReport({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      campaignType: type,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return { data, message: 'OK' };
  }

  @Get('attribution/:campaignId')
  @ApiOperation({ summary: 'Campaign ROI timeline' })
  async attributionTimeline(
    @Param('campaignId') campaignId: string,
    @Query('days') days?: string,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.analytics.getCampaignRoiTimeline(
      campaignId,
      days ? parseInt(days, 10) : undefined,
    );
    return { data, message: 'OK' };
  }

  @Get('fandom-trends')
  @ApiOperation({ summary: 'Fandom trend analysis' })
  async fandomTrends(@Query('days') days?: string): Promise<ApiResponse<unknown>> {
    const data = await this.analytics.getFandomTrends(days ? parseInt(days, 10) : undefined);
    return { data, message: 'OK' };
  }

  @Get('tiers')
  @ApiOperation({ summary: 'Tier analysis with CLV and revenue' })
  async tiers(): Promise<ApiResponse<unknown>> {
    const data = await this.analytics.getTierAnalysis();
    return { data, message: 'OK' };
  }

  @Get('channels')
  @ApiOperation({ summary: 'Web vs POS performance' })
  async channels(@Query('days') days?: string): Promise<ApiResponse<unknown>> {
    const data = await this.analytics.getChannelPerformance(days ? parseInt(days, 10) : undefined);
    return { data, message: 'OK' };
  }

  @Get('cohorts')
  @ApiOperation({ summary: 'Cohort retention matrix' })
  async cohorts(@Query('months') months?: string): Promise<ApiResponse<unknown>> {
    const data = await this.analytics.getCohortRetention(months ? parseInt(months, 10) : undefined);
    return { data, message: 'OK' };
  }

  @Post('snapshots/compute')
  @ApiOperation({ summary: 'Manually trigger snapshot' })
  async computeSnapshot(@Query('date') date?: string): Promise<ApiResponse<unknown>> {
    const data = await this.analytics.computeDailySnapshot(date ? new Date(date) : undefined);
    return { data, message: 'OK' };
  }

  @Post('clv/recompute')
  @ApiOperation({ summary: 'Trigger CLV recompute for all members' })
  async recomputeClv(): Promise<ApiResponse<unknown>> {
    const data = await this.analytics.recomputeAllClv();
    return { data, message: 'OK' };
  }

  @Get('export/:type')
  @ApiOperation({ summary: 'Export report' })
  async exportReport(
    @Param('type') type: string,
    @Query('format') format?: string,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.analytics.exportReport(type, format ?? 'json');
    return { data, message: 'OK' };
  }
}
