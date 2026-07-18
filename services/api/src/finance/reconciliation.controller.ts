import { Controller, Post, Get, Put, Body, Param, Query, UseGuards, Request, ParseUUIDPipe, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ReconciliationService } from './reconciliation.service';

@Controller('finance/reconciliation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'FINANCE')
export class ReconciliationController {
  constructor(private reconciliationService: ReconciliationService) {}

  @Post('run')
  async startRun(
    @Body() body: { periodStart: string; periodEnd: string },
    @Request() req: any,
  ) {
    // Validate required fields
    if (!body.periodStart || !body.periodEnd) {
      throw new BadRequestException('Both periodStart and periodEnd are required');
    }

    // Validate date formats
    const periodStart = new Date(body.periodStart);
    const periodEnd = new Date(body.periodEnd);
    
    if (isNaN(periodStart.getTime())) {
      throw new BadRequestException('Invalid periodStart date format');
    }
    if (isNaN(periodEnd.getTime())) {
      throw new BadRequestException('Invalid periodEnd date format');
    }
    if (periodStart >= periodEnd) {
      throw new BadRequestException('periodStart must be before periodEnd');
    }

    const result = await this.reconciliationService.startReconciliation({
      periodStart,
      periodEnd,
      startedById: req.user?.id,
    });
    return { data: result, message: 'Reconciliation completed' };
  }

  @Get('runs')
  async getRuns(@Query() query: { status?: string; page?: string; limit?: string }) {
    const result = await this.reconciliationService.getRuns({
      status: query.status,
      page: query.page ? parseInt(query.page) : undefined,
      limit: query.limit ? parseInt(query.limit) : undefined,
    });
    return { data: result.runs, pagination: result.pagination };
  }

  @Get('runs/:id')
  async getRunDetails(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.reconciliationService.getRunDetails(id);
    return { data: result };
  }

  @Put('items/:id/resolve')
  async resolveItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { resolution: string },
    @Request() req: any,
  ) {
    const result = await this.reconciliationService.resolveItem(id, req.user?.id, body.resolution);
    return { data: result, message: 'Item resolved' };
  }

  @Put('items/:id/ignore')
  async ignoreItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason: string },
    @Request() req: any,
  ) {
    const result = await this.reconciliationService.ignoreItem(id, req.user?.id, body.reason);
    return { data: result, message: 'Item ignored' };
  }
}
