import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';
import { AccountingService } from './accounting.service';
import { LedgerOutboxService } from './ledger-outbox.service';
import { ThreeWayReconService } from './three-way-recon.service';
import { XeroAuthService } from './xero-auth.service';
import type { ChartOfAccountsMapping } from './accounting.types';
import { randomBytes } from 'crypto';

@ApiTags('admin-accounting')
@ApiBearerAuth('JWT-auth')
@Controller('admin/accounting')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'FINANCE')
export class AccountingAdminController {
  constructor(
    private accounting: AccountingService,
    private outbox: LedgerOutboxService,
    private xeroAuth: XeroAuthService,
    private threeWayRecon: ThreeWayReconService,
  ) {}

  @Get('status')
  async status(): Promise<ApiResponse<unknown>> {
    return { data: await this.accounting.getStatus(), message: 'OK' };
  }

  @Get('outbox')
  async listOutbox(
    @Query('status') status?: string,
    @Query('entryType') entryType?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.outbox.list({
      status,
      entryType,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return { data, message: 'OK' };
  }

  @Post('outbox/:id/retry')
  async retryFailed(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<unknown>> {
    this.accounting.assertEnabled();
    const data = await this.outbox.retryFailed(id);
    return { data, message: 'Queued for retry' };
  }

  @Post('outbox/drain')
  async drainNow(): Promise<ApiResponse<unknown>> {
    this.accounting.assertEnabled();
    const data = await this.outbox.drainPending();
    return { data, message: 'Drain complete' };
  }

  /** CoA mapping stub — JSON config stored on Xero integration settings. */
  @Get('coa-mapping')
  async getCoaMapping(): Promise<ApiResponse<ChartOfAccountsMapping>> {
    return { data: await this.accounting.getCoaMapping(), message: 'OK' };
  }

  @Put('coa-mapping')
  async updateCoaMapping(
    @Body() body: Partial<ChartOfAccountsMapping>,
  ): Promise<ApiResponse<ChartOfAccountsMapping>> {
    const data = await this.accounting.updateCoaMapping(body);
    return { data, message: 'Updated' };
  }

  @Get('coa/remote-accounts')
  async remoteAccounts(): Promise<ApiResponse<unknown>> {
    const data = await this.accounting.fetchRemoteAccounts();
    return { data, message: 'OK' };
  }

  @Get('three-way-recon')
  async threeWayReconReport(): Promise<ApiResponse<unknown>> {
    const data = await this.threeWayRecon.getReport();
    return { data, message: 'OK' };
  }

  /**
   * OAuth connect URL stub.
   * Returns authorize URL with granular scopes documented on XeroAuthService.
   */
  @Get('oauth/connect-url')
  async connectUrl(): Promise<ApiResponse<unknown>> {
    const state = randomBytes(16).toString('hex');
    const { url, scopes } = this.xeroAuth.getConnectUrl(state);
    return {
      data: { url, scopes, state },
      message: 'Open url to authorize Xero (stub — exchange code via oauth/callback)',
    };
  }

  @Post('oauth/callback')
  async oauthCallback(
    @Body() body: { code: string },
  ): Promise<ApiResponse<unknown>> {
    this.accounting.assertEnabled();
    if (!body?.code) {
      return { data: null, message: 'code is required' };
    }
    await this.xeroAuth.exchangeCode(body.code);
    return { data: await this.xeroAuth.getConnectionStatus(), message: 'Connected' };
  }
}
