import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RevenueRecognitionService } from './revenue-recognition.service';

@Controller('finance/revenue-recognition')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'FINANCE')
export class RevenueRecognitionController {
  constructor(private revenueRecognitionService: RevenueRecognitionService) {}

  @Get('breakdown')
  async getBreakdown(@Query() query: { startDate?: string; endDate?: string }) {
    const now = new Date();
    const periodStart = query.startDate ? new Date(query.startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = query.endDate ? new Date(query.endDate) : now;
    const result = await this.revenueRecognitionService.getRevenueBreakdown(periodStart, periodEnd);
    return { data: result };
  }

  @Get('monthly')
  async getMonthly(@Query() query: { year?: string; month?: string }) {
    const now = new Date();
    const year = query.year ? parseInt(query.year) : now.getFullYear();
    const month = query.month ? parseInt(query.month) : now.getMonth() + 1;
    const result = await this.revenueRecognitionService.getMonthlyRecognition(year, month);
    return { data: result };
  }

  @Get('deferred')
  async getDeferredRevenue(@Query() query: { page?: string; limit?: string }) {
    const result = await this.revenueRecognitionService.getDeferredRevenueDetails(
      query.page ? parseInt(query.page) : 1,
      query.limit ? parseInt(query.limit) : 50,
    );
    return { data: result.orders, pagination: result.pagination };
  }
}
