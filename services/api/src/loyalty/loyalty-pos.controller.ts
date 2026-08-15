import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Headers,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ActivityService } from '../activity/activity.service';
import { Public } from '../common/decorators/public.decorator';
import { LoyaltyService } from './loyalty.service';
import { PosVoucherService } from './services/pos-voucher.service';
import { LookupMemberDto } from './dto/lookup-member.dto';
import { StaffEnrollDto } from './dto/staff-enroll.dto';
import { RedeemForVoucherDto } from './dto/redeem-for-voucher.dto';
import { LoyaltyStaffAuthGuard } from './guards/loyalty-staff-auth.guard';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('loyalty')
@Controller('loyalty')
export class LoyaltyPosController {
  constructor(
    private loyalty: LoyaltyService,
    private posVouchers: PosVoucherService,
    private activity: ActivityService,
  ) {}

  @Public()
  @Post('lookup')
  @UseGuards(LoyaltyStaffAuthGuard)
  // Matches POST /store/customers/search: this route reads customer PII, so it must not be
  // left on the generous global default (100/min) that would allow bulk harvesting.
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Lookup member by email, phone, or card (API key or admin/staff JWT)' })
  @ApiHeader({ name: 'x-api-key', required: false })
  @ApiBearerAuth('JWT-auth')
  async lookup(@Body() body: LookupMemberDto): Promise<ApiResponse<unknown>> {
    const data = await this.loyalty.lookupMember(body);
    return { data, message: 'OK' };
  }

  @Public()
  @Post('pos/enroll')
  @UseGuards(LoyaltyStaffAuthGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({
    summary:
      'In-store staff enrolment (requires email; API key or admin/staff JWT). Path is pos/enroll to avoid colliding with customer POST /loyalty/enroll.',
  })
  @ApiHeader({ name: 'x-api-key', required: false })
  @ApiBearerAuth('JWT-auth')
  async enroll(@Body() body: StaffEnrollDto): Promise<ApiResponse<unknown>> {
    const data = await this.loyalty.enrollFromPos(body);
    return { data, message: 'Enrolled' };
  }

  @Public()
  @Post('pos/redeem-for-voucher')
  @UseGuards(LoyaltyStaffAuthGuard)
  // Deliberately tight: this endpoint moves money (burns points, mints a gift card) and a
  // low ceiling also blunts guessing of terminal-supplied idempotency keys. A real till
  // serves one customer at a time, so 10/min is ample headroom.
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary:
      'Burn loyalty points at a HOS outlet and issue a Lightspeed gift card voucher for till payment. Requires an idempotency key (body or Idempotency-Key header) for new redemptions; pass voucherId to retry a FAILED issuance (same clientId).',
  })
  @ApiHeader({ name: 'x-api-key', required: false })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'Terminal replay key; alternative to body.idempotencyKey',
  })
  @ApiBearerAuth('JWT-auth')
  async redeemForVoucher(
    @Body() body: RedeemForVoucherDto,
    @Headers('idempotency-key') idempotencyKeyHeader?: string,
    @Req()
    req?: {
      user?: { id?: string; role?: string; storeId?: string | null };
      storeId?: string;
      ip?: string;
      headers?: Record<string, string | string[] | undefined>;
    },
  ): Promise<ApiResponse<unknown>> {
    const staffStoreId = req?.storeId || req?.user?.storeId || null;
    if (req?.user?.role === 'STORE_STAFF') {
      if (!staffStoreId) {
        throw new BadRequestException('Store staff must be assigned to a store');
      }
      if (body.storeId && body.storeId !== staffStoreId) {
        throw new ForbiddenException('Cannot redeem for a different store');
      }
      body = { ...body, storeId: staffStoreId };
    }

    const data = await this.posVouchers.redeemForVoucher({
      ...body,
      idempotencyKey: body.idempotencyKey?.trim() || idempotencyKeyHeader?.trim() || undefined,
    });

    // Points are money, so every redemption needs an actor trail — the staff search endpoint
    // already logs mere lookups. Fire-and-forget: an audit write must never fail a redemption
    // whose gift card is already issued. `userId` is undefined for API-key terminals, which the
    // guard admits without a user; `actor` records that so the gap is visible in the log.
    const userAgent = req?.headers?.['user-agent'];
    this.activity
      .createLog({
        userId: req?.user?.id,
        action: 'LOYALTY_POS_VOUCHER_REDEEM',
        entityType: 'LoyaltyPosVoucher',
        entityId: (data as { voucherId?: string })?.voucherId,
        description: `Burned ${body.points} points for a POS gift card voucher`,
        metadata: {
          actor: req?.user?.id ? 'staff' : 'api-key',
          role: req?.user?.role ?? null,
          storeId: body.storeId,
          points: body.points,
          retryOfVoucherId: body.voucherId ?? null,
          amount: (data as { amount?: number })?.amount ?? null,
          currency: (data as { currency?: string })?.currency ?? null,
          status: (data as { status?: string })?.status ?? null,
        },
        ipAddress: req?.ip,
        userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent,
      })
      .catch(() => undefined);

    return { data, message: 'Voucher issued' };
  }
}
