import {
  BadRequestException,
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
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';
import { AccountingService } from './accounting.service';
import { LedgerOutboxService } from './ledger-outbox.service';
import { ThreeWayReconService } from './three-way-recon.service';
import { XeroAuthService } from './xero-auth.service';
import { DailyJournalService } from './daily-journal.service';
import type { ChartOfAccountsMapping } from './accounting.types';

/** YYYY-MM-DD, as produced by an <input type="date">. */
const PERIOD_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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
    private dailyJournals: DailyJournalService,
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
  async retryFailed(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
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

  /**
   * Re-run daily journals for a calendar day (defaults to the prior UTC day, the
   * same period the nightly cron posts). Journals are idempotent per period, so a
   * re-run backfills a missed day without double-posting.
   */
  @Post('daily-journals/run')
  async runDailyJournals(@Body() body: { periodDate?: string }): Promise<ApiResponse<unknown>> {
    this.accounting.assertEnabled();
    const periodDate = body?.periodDate?.trim();
    if (periodDate) {
      // Round-trip through Date so overflow dates (2026-02-30) are rejected rather
      // than silently rolling into the next month and journaling the wrong day.
      const parsed = new Date(`${periodDate}T00:00:00.000Z`);
      if (
        !PERIOD_DATE_PATTERN.test(periodDate) ||
        Number.isNaN(parsed.getTime()) ||
        parsed.toISOString().slice(0, 10) !== periodDate
      ) {
        throw new BadRequestException('periodDate must be a valid YYYY-MM-DD date');
      }
      if (periodDate > this.dailyJournals.defaultPeriodDate()) {
        throw new BadRequestException('periodDate cannot be later than the last complete UTC day');
      }
    }
    const data = await this.dailyJournals.enqueueForPeriod(periodDate || undefined);
    return { data, message: `Daily journals enqueued for ${data.periodDate}` };
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
   * OAuth connect URL — generates a CSRF state token, stores it in XeroAuthService,
   * and returns the Xero authorize URL.
   */
  @Get('oauth/connect-url')
  async connectUrl(): Promise<ApiResponse<unknown>> {
    const { url, scopes, state } = await this.xeroAuth.createConnectUrl();
    return {
      data: { url, scopes, state },
      message: 'Open url to authorize Xero',
    };
  }

  /**
   * Xero redirects here via GET with ?code=…&state=… after the user authorizes.
   * Marked @Public because the browser redirect carries no JWT bearer token.
   * The state parameter is validated against the value stored during connect-url.
   */
  @Public()
  @Get('oauth/callback')
  async oauthCallback(
    @Query('code') code?: string,
    @Query('state') state?: string,
  ): Promise<ApiResponse<unknown>> {
    this.accounting.assertEnabled();
    if (!code) {
      throw new BadRequestException('code query parameter is required');
    }
    if (!state) {
      throw new BadRequestException('state query parameter is required');
    }
    await this.xeroAuth.validateAndConsumeState(state);
    await this.xeroAuth.exchangeCode(code);
    return { data: await this.xeroAuth.getConnectionStatus(), message: 'Connected' };
  }
}
