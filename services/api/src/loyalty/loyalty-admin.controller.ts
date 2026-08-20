import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';
import { PrismaService } from '../database/prisma.service';
import { LoyaltyService } from './loyalty.service';
import { AdminLoyaltyAdjustDto } from './dto/admin-adjust.dto';
import { ReassignVoucherDto } from './dto/reassign-voucher.dto';
import {
  UpdateLoyaltyTierDto,
  CreateEarnRuleDto,
  UpdateEarnRuleDto,
  CreateRedemptionOptionDto,
  UpdateRedemptionOptionDto,
  CreateCampaignDto,
  UpdateCampaignDto,
} from './dto/loyalty-admin.dto';
import { FandomProfileService } from './services/fandom-profile.service';
import { PosVoucherService } from './services/pos-voucher.service';
import { LoyaltyTierEngine } from './engines/tier.engine';
import { QueueService, JobType } from '../queue/queue.service';
import {
  LoyaltyProgrammeSettings,
  LoyaltySettingsService,
} from './services/loyalty-settings.service';

@ApiTags('admin-loyalty')
@ApiBearerAuth('JWT-auth')
@Controller('admin/loyalty')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class LoyaltyAdminController {
  constructor(
    private loyalty: LoyaltyService,
    private prisma: PrismaService,
    private fandomProfiles: FandomProfileService,
    private settings: LoyaltySettingsService,
    private posVouchers: PosVoucherService,
    private tierEngine: LoyaltyTierEngine,
    private queue: QueueService,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Loyalty programme KPIs' })
  async dashboard(): Promise<ApiResponse<unknown>> {
    const data = await this.loyalty.adminDashboard();
    return { data, message: 'OK' };
  }

  // ── Tiers ──────────────────────────────────────────────

  @Get('tiers')
  async tiers(): Promise<ApiResponse<unknown>> {
    const data = await this.prisma.loyaltyTier.findMany({ orderBy: { level: 'asc' } });
    return { data, message: 'OK' };
  }

  @Get('tiers/:id')
  async tier(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const data = await this.prisma.loyaltyTier.findUnique({
      where: { id },
      include: { _count: { select: { members: true } } },
    });
    return { data, message: 'OK' };
  }

  @Post('tiers/review')
  @ApiOperation({
    summary: 'Re-run tier placement for every member',
    description:
      'Applies the current thresholds to the existing member base. Run this after editing a tier threshold — placement is otherwise only recomputed when a member earns points or by the weekly cron.',
  })
  async reviewTiers(): Promise<ApiResponse<unknown>> {
    const jobId = await this.queue.addJob(JobType.LOYALTY_TIER_REVIEW, {});
    return {
      data: { jobId, status: 'queued' },
      message: 'Tier review queued — results will be processed in the background',
    };
  }

  @Put('tiers/:id')
  async updateTier(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateLoyaltyTierDto,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.prisma.loyaltyTier.update({
      where: { id },
      data: body as any,
    });
    return { data, message: 'Updated' };
  }

  // ── Earn Rules ─────────────────────────────────────────

  @Get('earn-rules')
  async earnRules(): Promise<ApiResponse<unknown>> {
    const data = await this.prisma.loyaltyEarnRule.findMany({ orderBy: { action: 'asc' } });
    return { data, message: 'OK' };
  }

  @Post('earn-rules')
  async createEarnRule(@Body() body: CreateEarnRuleDto): Promise<ApiResponse<unknown>> {
    const data = await this.prisma.loyaltyEarnRule.create({ data: body as any });
    return { data, message: 'Created' };
  }

  @Put('earn-rules/:id')
  async updateEarnRule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateEarnRuleDto,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.prisma.loyaltyEarnRule.update({ where: { id }, data: body as any });
    return { data, message: 'Updated' };
  }

  @Delete('earn-rules/:id')
  async deleteEarnRule(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    await this.prisma.loyaltyEarnRule.delete({ where: { id } });
    return { data: null, message: 'Deleted' };
  }

  // ── Redemption Options ─────────────────────────────────

  @Get('redemption-options')
  async redemptionOptions(): Promise<ApiResponse<unknown>> {
    const data = await this.prisma.loyaltyRedemptionOption.findMany({
      orderBy: { pointsCost: 'asc' },
    });
    return { data, message: 'OK' };
  }

  @Post('redemption-options')
  async createRedemptionOption(
    @Body() body: CreateRedemptionOptionDto,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.prisma.loyaltyRedemptionOption.create({ data: body as any });
    return { data, message: 'Created' };
  }

  @Put('redemption-options/:id')
  async updateRedemptionOption(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateRedemptionOptionDto,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.prisma.loyaltyRedemptionOption.update({
      where: { id },
      data: body as any,
    });
    return { data, message: 'Updated' };
  }

  @Delete('redemption-options/:id')
  async deleteRedemptionOption(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<unknown>> {
    const redeemed = await this.prisma.loyaltyRedemption.count({ where: { optionId: id } });
    if (redeemed > 0) {
      await this.prisma.loyaltyRedemptionOption.update({
        where: { id },
        data: { isActive: false },
      });
      return { data: null, message: 'Deactivated (has redemption history)' };
    }
    await this.prisma.loyaltyRedemptionOption.delete({ where: { id } });
    return { data: null, message: 'Deleted' };
  }

  // ── Campaigns ──────────────────────────────────────────

  @Get('campaigns')
  async campaigns(): Promise<ApiResponse<unknown>> {
    const data = await this.prisma.loyaltyBonusCampaign.findMany({ orderBy: { startsAt: 'desc' } });
    return { data, message: 'OK' };
  }

  @Post('campaigns')
  async createCampaign(@Body() body: CreateCampaignDto): Promise<ApiResponse<unknown>> {
    const data = await this.prisma.loyaltyBonusCampaign.create({ data: body as any });
    return { data, message: 'Created' };
  }

  @Put('campaigns/:id')
  async updateCampaign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateCampaignDto,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.prisma.loyaltyBonusCampaign.update({
      where: { id },
      data: body as any,
    });
    return { data, message: 'Updated' };
  }

  @Delete('campaigns/:id')
  async deleteCampaign(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    await this.prisma.loyaltyBonusCampaign.delete({ where: { id } });
    return { data: null, message: 'Deleted' };
  }

  // ── Members ────────────────────────────────────────────

  @Get('members')
  @ApiOperation({ summary: 'List loyalty members (paginated)' })
  async members(
    @Query('q') q?: string,
    @Query('page') pageRaw?: string,
    @Query('limit') limitRaw?: string,
  ): Promise<ApiResponse<unknown>> {
    const page = Math.max(1, parseInt(pageRaw || '1', 10) || 1);
    // Allow larger batches for CSV/Excel export; UI list uses ~25.
    const limit = Math.min(5000, Math.max(1, parseInt(limitRaw || '25', 10) || 25));
    const term = q?.trim() || '';
    const parts = term.split(/\s+/).filter(Boolean);
    const where = term
      ? {
          OR: [
            { user: { email: { contains: term, mode: 'insensitive' as const } } },
            { user: { firstName: { contains: term, mode: 'insensitive' as const } } },
            { user: { lastName: { contains: term, mode: 'insensitive' as const } } },
            { cardNumber: { contains: term, mode: 'insensitive' as const } },
            // Support "First Last" queries across separate name columns
            ...(parts.length >= 2
              ? [
                  {
                    AND: [
                      { user: { firstName: { contains: parts[0], mode: 'insensitive' as const } } },
                      {
                        user: {
                          lastName: {
                            contains: parts.slice(1).join(' '),
                            mode: 'insensitive' as const,
                          },
                        },
                      },
                    ],
                  },
                ]
              : []),
          ],
        }
      : undefined;

    const [total, data] = await this.prisma.$transaction([
      this.prisma.loyaltyMembership.count({ where }),
      this.prisma.loyaltyMembership.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
          tier: true,
        },
        orderBy: { enrolledAt: 'desc' },
      }),
    ]);

    return {
      data,
      message: 'OK',
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  @Get('members/:userId')
  async member(@Param('userId', ParseUUIDPipe) userId: string): Promise<ApiResponse<unknown>> {
    const data = await this.prisma.loyaltyMembership.findUnique({
      where: { userId },
      include: { tier: true, user: { select: { email: true, firstName: true, lastName: true } } },
    });
    return { data, message: 'OK' };
  }

  @Delete('members/:userId')
  @ApiOperation({
    summary: 'Delete a loyalty membership (optionally the user account for test cleanup)',
  })
  async deleteMember(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('deleteUser') deleteUserRaw?: string,
  ): Promise<ApiResponse<unknown>> {
    const deleteUser = deleteUserRaw === '1' || deleteUserRaw === 'true' || deleteUserRaw === 'yes';
    const data = await this.loyalty.adminDeleteMember(userId, { deleteUser });
    return {
      data,
      message: deleteUser
        ? 'Loyalty membership and user account deleted'
        : 'Loyalty membership deleted',
    };
  }

  @Get('fandom-profile/:userId')
  @ApiOperation({ summary: 'Member fandom affinity profile (JSON)' })
  async fandomProfile(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<ApiResponse<unknown>> {
    const m = await this.prisma.loyaltyMembership.findUnique({
      where: { userId },
      select: { fandomProfile: true, userId: true },
    });
    return { data: m?.fandomProfile ?? {}, message: 'OK' };
  }

  @Post('fandom-profiles/recompute')
  @ApiOperation({ summary: 'Recompute all member fandom profiles' })
  async recomputeFandom(): Promise<ApiResponse<unknown>> {
    const count = await this.fandomProfiles.batchUpdateProfiles();
    return { data: { count }, message: 'OK' };
  }

  @Post('adjust')
  async adjust(@Body() body: AdminLoyaltyAdjustDto): Promise<ApiResponse<unknown>> {
    const data = await this.loyalty.adminAdjustPoints(body.userId, body.pointsDelta, body.reason);
    return { data, message: 'Adjusted' };
  }

  @Get('transactions')
  @ApiOperation({
    summary: 'Loyalty ledger',
    description:
      'Points ledger across all members. Supports a createdAt range so finance can pull a closed period for CSV export.',
  })
  async transactions(
    @Query('membershipId') membershipId?: string,
    @Query('type') type?: string,
    @Query('channel') channel?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ApiResponse<unknown>> {
    const take = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const pageNum = Math.max(Number(page) || 1, 1);
    const where: Record<string, unknown> = {};
    if (membershipId) where.membershipId = membershipId;
    if (type) where.type = type;
    if (channel) where.channel = channel;
    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
        ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
      };
    }
    const [data, total] = await Promise.all([
      this.prisma.loyaltyTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip: (pageNum - 1) * take,
        include: {
          membership: {
            select: {
              id: true,
              userId: true,
              cardNumber: true,
              user: { select: { email: true, firstName: true, lastName: true } },
            },
          },
        },
      }),
      this.prisma.loyaltyTransaction.count({ where }),
    ]);
    return {
      data,
      message: 'OK',
      pagination: { page: pageNum, limit: take, total, totalPages: Math.ceil(total / take) },
    } as ApiResponse<unknown>;
  }

  @Get('settings')
  @ApiOperation({ summary: 'Get loyalty programme settings (DB over env)' })
  async getSettings(): Promise<ApiResponse<unknown>> {
    const { settings, source } = await this.settings.getResolved(true);
    return { data: { settings, source }, message: 'OK' };
  }

  @Put('settings')
  @ApiOperation({ summary: 'Update loyalty programme settings' })
  async putSettings(
    @Body() body: Partial<LoyaltyProgrammeSettings>,
  ): Promise<ApiResponse<unknown>> {
    try {
      const settings = await this.settings.update(body || {});
      return { data: settings, message: 'Settings saved' };
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }

  @Get('runtime-status')
  @ApiOperation({ summary: 'Effective loyalty/POS/accounting runtime gates' })
  async runtimeStatus(): Promise<ApiResponse<unknown>> {
    const data = await this.settings.getRuntimeStatus();
    return { data, message: 'OK' };
  }

  @Get('members/:userId/instruments')
  @ApiOperation({ summary: 'Member balance instruments (points, GCs, vouchers)' })
  async memberInstruments(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<ApiResponse<unknown>> {
    const membership = await this.prisma.loyaltyMembership.findUnique({
      where: { userId },
      include: {
        tier: true,
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
    if (!membership) throw new BadRequestException('Membership not found');
    const [giftCards, vouchers] = await Promise.all([
      this.prisma.giftCard.findMany({
        where: { userId, status: 'ACTIVE' },
        select: { id: true, code: true, balance: true, currency: true, status: true },
      }),
      this.prisma.loyaltyPosVoucher.findMany({
        where: { membershipId: membership.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);
    return {
      data: {
        membership,
        giftCards,
        posVouchers: vouchers,
      },
      message: 'OK',
    };
  }

  @Get('pos-vouchers')
  @ApiOperation({ summary: 'List POS loyalty vouchers' })
  async listPosVouchers(
    @Query('status') status?: string,
    @Query('storeId') storeId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ApiResponse<unknown>> {
    const take = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const pageNum = Math.max(Number(page) || 1, 1);
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (storeId) where.storeId = storeId;
    const [data, total] = await Promise.all([
      this.prisma.loyaltyPosVoucher.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip: (pageNum - 1) * take,
        include: {
          membership: {
            select: {
              id: true,
              userId: true,
              user: { select: { email: true, firstName: true, lastName: true } },
            },
          },
          store: { select: { id: true, name: true, code: true } },
        },
      }),
      this.prisma.loyaltyPosVoucher.count({ where }),
    ]);
    return {
      data,
      message: 'OK',
      pagination: { page: pageNum, limit: take, total, totalPages: Math.ceil(total / take) },
    } as ApiResponse<unknown>;
  }

  @Get('pos-vouchers/:id')
  async getPosVoucher(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const data = await this.prisma.loyaltyPosVoucher.findUnique({
      where: { id },
      include: {
        membership: {
          include: { user: { select: { email: true, firstName: true, lastName: true } } },
        },
        store: true,
      },
    });
    if (!data) throw new BadRequestException('Voucher not found');
    return { data, message: 'OK' };
  }

  @Post('pos-vouchers/:id/cancel')
  @ApiOperation({
    summary: 'Manager cancel an unused ISSUED voucher (Flow A5)',
    description:
      'Voids the Lightspeed gift card, reverses the points burn, and marks the voucher REVERSED.',
  })
  async cancelPosVoucher(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: { id: string } },
    @Body() body: { reason?: string },
  ): Promise<ApiResponse<unknown>> {
    const data = await this.posVouchers.cancelVoucher({
      voucherId: id,
      actorUserId: req.user.id,
      actorRole: 'ADMIN',
      reason: body?.reason,
    });
    return { data, message: 'Voucher cancelled' };
  }

  @Post('pos-vouchers/:id/retry')
  @ApiOperation({
    summary: 'Retry issuing the POS gift card for a FAILED/PENDING voucher',
    description:
      'Re-attempts the Lightspeed gift-card issuance for an existing voucher, re-debiting the points if the burn was reversed. Safe to call repeatedly — an already ISSUED voucher is returned unchanged.',
  })
  async retryPosVoucher(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const data = await this.posVouchers.retryFailedVoucher(id);
    return { data, message: 'Voucher issuance retried' };
  }

  @Post('pos-vouchers/:id/reassign')
  @ApiOperation({ summary: 'Reassign a POS voucher to a different store (admin only)' })
  async reassignPosVoucher(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReassignVoucherDto,
  ): Promise<ApiResponse<unknown>> {
    const voucher = await this.prisma.loyaltyPosVoucher.findUnique({ where: { id } });
    if (!voucher) throw new BadRequestException('Voucher not found');
    if (voucher.status === 'ISSUED') throw new BadRequestException('Cannot reassign an ISSUED voucher');
    const store = await this.prisma.store.findUnique({
      where: { id: body.storeId },
      include: { posConnection: true },
    });
    if (!store?.isActive) throw new BadRequestException('Target store not found or inactive');
    if (!store.posConnection?.isActive) throw new BadRequestException('Target store has no active POS connection');

    const metadata = (voucher.metadata as Record<string, unknown>) ?? {};
    delete metadata.lightspeedPermission;
    delete metadata.failedAt;

    const cleanedMetadata: Prisma.InputJsonValue | undefined =
      Object.keys(metadata).length > 0
        ? (metadata as Prisma.InputJsonValue)
        : undefined;

    const data = await this.prisma.loyaltyPosVoucher.update({
      where: { id },
      data: {
        storeId: body.storeId,
        currency: store.currency || voucher.currency,
        metadata: cleanedMetadata,
      },
    });
    return { data, message: 'Voucher reassigned' };
  }

  @Get('identity-reviews')
  @ApiOperation({ summary: 'Open identity match reviews (Lightspeed ↔ HOS)' })
  async identityReviews(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ApiResponse<unknown>> {
    const take = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const pageNum = Math.max(Number(page) || 1, 1);
    const where = { status: status || 'OPEN' };
    const [data, total] = await Promise.all([
      this.prisma.identityMatchReview.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip: (pageNum - 1) * take,
      }),
      this.prisma.identityMatchReview.count({ where }),
    ]);
    return {
      data,
      message: 'OK',
      pagination: { page: pageNum, limit: take, total, totalPages: Math.ceil(total / take) },
    } as ApiResponse<unknown>;
  }

  @Patch('identity-reviews/:id')
  @ApiOperation({ summary: 'Resolve an identity match review' })
  async resolveIdentityReview(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: { status: 'MERGED' | 'REJECTED' | 'IGNORED'; note?: string; proposedInternalId?: string },
  ): Promise<ApiResponse<unknown>> {
    if (!body?.status || !['MERGED', 'REJECTED', 'IGNORED'].includes(body.status)) {
      throw new BadRequestException('status must be MERGED, REJECTED, or IGNORED');
    }

    const review = await this.prisma.identityMatchReview.findUnique({ where: { id } });
    if (!review) throw new BadRequestException('Identity review not found');
    if (review.status !== 'OPEN') {
      throw new BadRequestException(`Review is already ${review.status}`);
    }

    let proposedInternalId = body.proposedInternalId ?? review.proposedInternalId ?? null;

    if (body.status === 'MERGED') {
      if (!review.lightspeedCustomerId) {
        throw new BadRequestException('Cannot merge: review has no Lightspeed customer id');
      }
      if (!proposedInternalId && review.candidateInternalIds?.length === 1) {
        proposedInternalId = review.candidateInternalIds[0];
      }
      if (!proposedInternalId) {
        throw new BadRequestException(
          'proposedInternalId is required to merge (HOS user id or loyalty membership id)',
        );
      }

      // Candidates may be userId (sales import) or membershipId (backfill).
      let membership = await this.prisma.loyaltyMembership.findUnique({
        where: { id: proposedInternalId },
        select: { id: true, userId: true },
      });
      if (!membership) {
        membership = await this.prisma.loyaltyMembership.findUnique({
          where: { userId: proposedInternalId },
          select: { id: true, userId: true },
        });
      }
      if (!membership) {
        throw new BadRequestException(
          'No loyalty membership found for proposedInternalId — enroll the user first',
        );
      }

      try {
        await this.prisma.externalEntityMapping.upsert({
          where: {
            provider_entityType_internalId_storeId: {
              provider: review.provider || 'lightspeed',
              entityType: 'CUSTOMER',
              internalId: membership.id,
              storeId: '',
            },
          },
          create: {
            provider: review.provider || 'lightspeed',
            entityType: 'CUSTOMER',
            internalId: membership.id,
            externalId: review.lightspeedCustomerId,
            storeId: '',
            syncStatus: 'SYNCED',
            lastSyncedAt: new Date(),
            metadata: {
              source: 'identity_match_review',
              reviewId: review.id,
              linkedUserId: membership.userId,
            },
          },
          update: {
            externalId: review.lightspeedCustomerId,
            syncStatus: 'SYNCED',
            lastSyncedAt: new Date(),
            syncError: null,
            metadata: {
              source: 'identity_match_review',
              reviewId: review.id,
              linkedUserId: membership.userId,
            },
          },
        });
      } catch (e) {
        throw new BadRequestException(
          `Could not link Lightspeed customer: ${(e as Error).message}`,
        );
      }

      proposedInternalId = membership.id;
    }

    const data = await this.prisma.identityMatchReview.update({
      where: { id },
      data: {
        status: body.status,
        resolutionNote: body.note ?? null,
        proposedInternalId: proposedInternalId ?? undefined,
        resolvedAt: new Date(),
      },
    });
    return { data, message: 'Resolved' };
  }

  @Get('liability-report')
  @Roles('ADMIN', 'FINANCE')
  @ApiOperation({ summary: 'HOS loyalty & gift-card liability report (SoR)' })
  async liabilityReport(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<ApiResponse<unknown>> {
    const { settings } = await this.settings.getResolved();
    const redeem = settings.defaultRedeemValue;
    const start = from ? new Date(`${from}T00:00:00.000Z`) : new Date(Date.now() - 30 * 86400000);
    const end = to ? new Date(`${to}T23:59:59.999Z`) : new Date();

    const [
      balanceAgg,
      earnAgg,
      burnAgg,
      expireAgg,
      gcLiability,
      gcIssued,
      gcRedeemed,
      gcRefunded,
      vouchersIssued,
    ] = await Promise.all([
      this.prisma.loyaltyMembership.aggregate({ _sum: { currentBalance: true } }),
      this.prisma.loyaltyTransaction.aggregate({
        where: { type: 'EARN', createdAt: { gte: start, lte: end } },
        _sum: { points: true },
      }),
      this.prisma.loyaltyTransaction.aggregate({
        where: { type: 'BURN', createdAt: { gte: start, lte: end } },
        _sum: { points: true },
      }),
      this.prisma.loyaltyTransaction.aggregate({
        where: { type: 'EXPIRE', createdAt: { gte: start, lte: end } },
        _sum: { points: true },
      }),
      this.prisma.giftCard.aggregate({
        where: { status: 'ACTIVE' },
        _sum: { balance: true },
      }),
      this.prisma.giftCardTransaction.aggregate({
        where: { type: 'PURCHASE', createdAt: { gte: start, lte: end } },
        _sum: { amount: true },
      }),
      this.prisma.giftCardTransaction.aggregate({
        where: { type: 'REDEMPTION', createdAt: { gte: start, lte: end } },
        _sum: { amount: true },
      }),
      this.prisma.giftCardTransaction.aggregate({
        where: { type: 'REFUND', createdAt: { gte: start, lte: end } },
        _sum: { amount: true },
      }),
      this.prisma.loyaltyPosVoucher.aggregate({
        where: { status: 'ISSUED', issuedAt: { gte: start, lte: end } },
        _sum: { amount: true },
      }),
    ]);

    const pointsOutstanding = balanceAgg._sum.currentBalance ?? 0;
    const n = (v: unknown) => Number(v || 0);
    return {
      data: {
        period: { from: start.toISOString(), to: end.toISOString() },
        redeemValuePerPoint: redeem,
        pointsOutstanding,
        pointsOutstandingValue: pointsOutstanding * redeem,
        periodEarnPoints: n(earnAgg._sum.points),
        periodBurnPoints: Math.abs(n(burnAgg._sum.points)),
        periodExpirePoints: Math.abs(n(expireAgg._sum.points)),
        periodBreakageValue: Math.abs(n(expireAgg._sum.points)) * redeem,
        hosGiftCardLiability: n(gcLiability._sum.balance),
        periodGcIssued: n(gcIssued._sum.amount),
        periodGcRedeemed: n(gcRedeemed._sum.amount),
        periodGcRefunded: n(gcRefunded._sum.amount),
        periodPosVouchersIssued: n(vouchersIssued._sum.amount),
      },
      message: 'OK',
    };
  }
}
