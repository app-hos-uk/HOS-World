import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AgingService } from './aging.service';

@Controller('finance/aging')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'FINANCE')
export class AgingController {
  constructor(private agingService: AgingService) {}

  @Get()
  async getFullReport() {
    const result = await this.agingService.getFullAgingReport();
    return { data: result };
  }

  @Get('transactions')
  async getTransactionAging() {
    const result = await this.agingService.getTransactionAging();
    return { data: result };
  }

  @Get('settlements')
  async getSettlementAging() {
    const result = await this.agingService.getSettlementAging();
    return { data: result };
  }

  @Get('disputes')
  async getDisputeAging() {
    const result = await this.agingService.getDisputeAging();
    return { data: result };
  }
}
