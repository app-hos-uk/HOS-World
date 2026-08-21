import { Controller, Get, Post, Put, Body, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireAccess } from '../access-control/decorators/require-access.decorator';
import { PeriodCloseService } from './period-close.service';

@Controller('finance/periods')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'FINANCE')
export class PeriodCloseController {
  constructor(private periodCloseService: PeriodCloseService) {}

  @Get()
  @RequireAccess({ permission: 'finance.view', scope: 'GLOBAL' })
  async getPeriods(@Query() query: { year?: string; status?: string }) {
    const result = await this.periodCloseService.getPeriods({
      year: query.year ? parseInt(query.year) : undefined,
      status: query.status,
    });
    return { data: result };
  }

  @Post('close')
  @RequireAccess({ permission: 'finance.manage', scope: 'GLOBAL' })
  async closePeriod(
    @Body() body: { year: number; month: number; notes?: string },
    @Request() req: any,
  ) {
    const result = await this.periodCloseService.closePeriod(
      body.year,
      body.month,
      req.user?.id,
      body.notes,
    );
    return {
      data: result,
      message: `Period ${body.year}-${String(body.month).padStart(2, '0')} closed`,
    };
  }

  @Put('reopen')
  @RequireAccess({ permission: 'finance.manage', scope: 'GLOBAL' })
  async reopenPeriod(@Body() body: { year: number; month: number }) {
    const result = await this.periodCloseService.reopenPeriod(body.year, body.month);
    return {
      data: result,
      message: `Period ${body.year}-${String(body.month).padStart(2, '0')} reopened`,
    };
  }
}
