import { Controller, Get, Put, Param, Query, Body, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { DisputesService } from './disputes.service';

@Controller('finance/disputes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'FINANCE')
export class DisputesController {
  constructor(private disputesService: DisputesService) {}

  @Get()
  async getDisputes(@Query() query: { status?: string; sellerId?: string; page?: string; limit?: string }) {
    const result = await this.disputesService.getDisputes({
      status: query.status,
      sellerId: query.sellerId,
      page: query.page ? parseInt(query.page) : undefined,
      limit: query.limit ? parseInt(query.limit) : undefined,
    });
    return { data: result.disputes, pagination: result.pagination };
  }

  @Get('seller/:sellerId/chargeback-rate')
  async getChargebackRate(@Param('sellerId') sellerId: string) {
    const result = await this.disputesService.getSellerChargebackRate(sellerId);
    return { data: result };
  }

  @Get(':id')
  async getDispute(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.disputesService.getDisputeById(id);
    return { data: result };
  }

  @Put(':id/status')
  async updateStatus(@Param('id', ParseUUIDPipe) id: string, @Body() body: { status: string; notes?: string }) {
    const result = await this.disputesService.updateDisputeStatus(id, body.status, body.notes);
    return { data: result, message: 'Dispute status updated' };
  }

  @Put(':id/evidence-submitted')
  async markEvidenceSubmitted(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.disputesService.markEvidenceSubmitted(id);
    return { data: result, message: 'Evidence marked as submitted' };
  }
}
