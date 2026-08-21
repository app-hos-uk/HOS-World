import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireAccess } from '../access-control/decorators/require-access.decorator';
import { AgingService } from './aging.service';

@Controller('finance/aging')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'FINANCE')
export class AgingController {
  constructor(private agingService: AgingService) {}

  @Get()
  @RequireAccess({ permission: 'finance.view', scope: 'GLOBAL' })
  async getFullReport() {
    const result = await this.agingService.getFullAgingReport();
    return { data: result };
  }

  @Get('transactions')
  @RequireAccess({ permission: 'finance.view', scope: 'GLOBAL' })
  async getTransactionAging() {
    const result = await this.agingService.getTransactionAging();
    return { data: result };
  }

  @Get('settlements')
  @RequireAccess({ permission: 'finance.view', scope: 'GLOBAL' })
  async getSettlementAging() {
    const result = await this.agingService.getSettlementAging();
    return { data: result };
  }

  @Get('disputes')
  @RequireAccess({ permission: 'finance.view', scope: 'GLOBAL' })
  async getDisputeAging() {
    const result = await this.agingService.getDisputeAging();
    return { data: result };
  }
}
