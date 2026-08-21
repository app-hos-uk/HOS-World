import {
  Controller,
  Get,
  Put,
  Param,
  Query,
  Body,
  UseGuards,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireAccess } from '../access-control/decorators/require-access.decorator';
import { DisputesService } from './disputes.service';

const DISPUTE_STATUSES = [
  'OPEN',
  'UNDER_REVIEW',
  'EVIDENCE_REQUIRED',
  'WON',
  'LOST',
  'CLOSED',
] as const;

/** Rejects unknown values up front so Prisma never receives an invalid enum (which surfaces as a 500). */
function assertDisputeStatus(status: string): string {
  const normalized = status.trim().toUpperCase();
  if (!DISPUTE_STATUSES.includes(normalized as (typeof DISPUTE_STATUSES)[number])) {
    throw new BadRequestException(
      `Invalid dispute status "${status}". Expected one of: ${DISPUTE_STATUSES.join(', ')}`,
    );
  }
  return normalized;
}

@Controller('finance/disputes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'FINANCE')
export class DisputesController {
  constructor(private disputesService: DisputesService) {}

  @Get()
  @RequireAccess({ permission: 'finance.view', scope: 'GLOBAL' })
  async getDisputes(
    @Query() query: { status?: string; sellerId?: string; page?: string; limit?: string },
  ) {
    const result = await this.disputesService.getDisputes({
      status: query.status ? assertDisputeStatus(query.status) : undefined,
      sellerId: query.sellerId,
      page: query.page ? parseInt(query.page) : undefined,
      limit: query.limit ? parseInt(query.limit) : undefined,
    });
    return { data: result.disputes, pagination: result.pagination };
  }

  @Get('seller/:sellerId/chargeback-rate')
  @RequireAccess({ permission: 'finance.view', scope: 'GLOBAL' })
  async getChargebackRate(@Param('sellerId') sellerId: string) {
    const result = await this.disputesService.getSellerChargebackRate(sellerId);
    return { data: result };
  }

  @Get(':id')
  @RequireAccess({ permission: 'finance.view', scope: 'GLOBAL' })
  async getDispute(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.disputesService.getDisputeById(id);
    return { data: result };
  }

  @Put(':id/status')
  @RequireAccess({ permission: 'finance.manage', scope: 'GLOBAL' })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { status: string; notes?: string },
  ) {
    if (!body?.status) throw new BadRequestException('status is required');
    const result = await this.disputesService.updateDisputeStatus(
      id,
      assertDisputeStatus(body.status),
      body.notes,
    );
    return { data: result, message: 'Dispute status updated' };
  }

  @Put(':id/evidence-submitted')
  @RequireAccess({ permission: 'finance.manage', scope: 'GLOBAL' })
  async markEvidenceSubmitted(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.disputesService.markEvidenceSubmitted(id);
    return { data: result, message: 'Evidence marked as submitted' };
  }
}
