import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
  Inject,
  forwardRef,
  Optional,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, UserRole, LoyaltyTxType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { randomBytes } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { LoyaltyBurnEngine } from './engines/burn.engine';
import { LoyaltyEarnEngine } from './engines/earn.engine';
import { LoyaltyTierEngine } from './engines/tier.engine';
import { LoyaltyWalletService } from './services/wallet.service';
import { LoyaltyReferralService } from './services/referral.service';
import { LoyaltyEventService } from './services/loyalty-event.service';
import { QueueService, JobType } from '../queue/queue.service';
import { LoyaltyListener } from './listeners/loyalty.listener';
import { EnrollLoyaltyDto } from './dto/enroll.dto';
import { LoyaltyPreferencesDto } from './dto/loyalty-preferences.dto';
import { MarketingEventBus } from '../journeys/marketing-event.bus';

@Injectable()
export class LoyaltyService {
  private readonly logger = new Logger(LoyaltyService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private burn: LoyaltyBurnEngine,
    private earn: LoyaltyEarnEngine,
    private tiers: LoyaltyTierEngine,
    private wallet: LoyaltyWalletService,
    private referrals: LoyaltyReferralService,
    private events: LoyaltyEventService,
    private queue: QueueService,
    private loyaltyListener: LoyaltyListener,
    @Optional() @Inject(forwardRef(() => MarketingEventBus))
    private marketingBus?: MarketingEventBus,
  ) {}

  assertEnabled(): void {
    if (this.config.get<string>('LOYALTY_ENABLED') !== 'true') {
      throw new BadRequestException('Loyalty programme is not enabled');
    }
  }

  async enroll(userId: string, dto?: EnrollLoyaltyDto) {
    this.assertEnabled();
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role !== UserRole.CUSTOMER) {
      throw new BadRequestException('Only customers can enroll');
    }

    const existing = await this.prisma.loyaltyMembership.findUnique({ where: { userId } });
    if (existing) throw new ConflictException('Already enrolled');

    const initiate = await this.prisma.loyaltyTier.findFirst({
      where: { slug: 'initiate', isActive: true },
    });
    if (!initiate) throw new BadRequestException('Loyalty tiers not configured');

    const prefix = this.config.get<string>('LOYALTY_CARD_PREFIX', 'HOS');
    const cardNumber = `${prefix}-${randomBytes(4).toString('hex').toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`;

    const membership = await this.prisma.loyaltyMembership.create({
      data: {
        userId,
        tierId: initiate.id,
        regionCode: dto?.regionCode || user.country || 'GB',
        preferredCurrency: dto?.preferredCurrency || user.currencyPreference || 'GBP',
        enrollmentChannel: dto?.enrollmentChannel || 'WEB',
        cardNumber,
      },
      include: { tier: true },
    });

    this.events.onWelcome(userId, initiate.name).catch((e: unknown) => {
      this.logger.warn(`Welcome event failed for ${userId}: ${e instanceof Error ? e.message : 'unknown'}`);
    });

    void this.marketingBus
      ?.emit('LOYALTY_WELCOME', userId, {
        tierName: initiate.name,
        firstName: user.firstName || '',
      })
      .catch((e: unknown) => {
        this.logger.warn(`Marketing welcome event failed for ${userId}: ${e instanceof Error ? e.message : 'unknown'}`);
      });

    if (this.config.get<string>('POS_ENABLED') === 'true') {
      void this.queue.addJob(JobType.POS_CUSTOMER_SYNC, { userId }).catch((e: unknown) => {
        this.logger.warn(`POS sync job enqueue failed for ${userId}: ${e instanceof Error ? e.message : 'unknown'}`);
      });
    }

    const ref = dto?.referralCode?.trim();
    if (ref) {
      await this.loyaltyListener.onUserRegistered(userId, ref);
    }

    return membership;
  }

  async getMembership(userId: string) {
    return this.prisma.loyaltyMembership.findUnique({
      where: { userId },
      include: { tier: true },
    });
  }

  async getPreferences(userId: string) {
    this.assertEnabled();
    const m = await this.prisma.loyaltyMembership.findUnique({ where: { userId } });
    if (!m) throw new NotFoundException('Not enrolled');
    return {
      optInEmail: m.optInEmail,
      optInSms: m.optInSms,
      optInWhatsApp: m.optInWhatsApp,
      optInPush: m.optInPush,
    };
  }

  async updatePreferences(
    userId: string,
    dto: LoyaltyPreferencesDto,
    audit?: { ipAddress?: string | null; userAgent?: string | null },
  ) {
    this.assertEnabled();
    const m = await this.prisma.loyaltyMembership.findUnique({ where: { userId } });
    if (!m) throw new NotFoundException('Not enrolled');
    const data: {
      optInEmail?: boolean;
      optInSms?: boolean;
      optInWhatsApp?: boolean;
      optInPush?: boolean;
    } = {};
    if (dto.optInEmail !== undefined) data.optInEmail = dto.optInEmail;
    if (dto.optInSms !== undefined) data.optInSms = dto.optInSms;
    if (dto.optInWhatsApp !== undefined) data.optInWhatsApp = dto.optInWhatsApp;
    if (dto.optInPush !== undefined) data.optInPush = dto.optInPush;
    if (Object.keys(data).length === 0) {
      throw new BadRequestException(
        'At least one of optInEmail, optInSms, optInWhatsApp, or optInPush must be provided',
      );
    }
    const ip = audit?.ipAddress?.trim() || null;
    const ua = audit?.userAgent?.trim() || null;
    const now = new Date();
    const consentRows: Array<{
      userId: string;
      consentType: string;
      granted: boolean;
      grantedAt: Date;
      ipAddress: string | null;
      userAgent: string | null;
    }> = [];
    if (dto.optInEmail !== undefined) {
      consentRows.push({ userId, consentType: 'LOYALTY_MARKETING_EMAIL', granted: dto.optInEmail, grantedAt: now, ipAddress: ip, userAgent: ua });
    }
    if (dto.optInSms !== undefined) {
      consentRows.push({ userId, consentType: 'LOYALTY_MARKETING_SMS', granted: dto.optInSms, grantedAt: now, ipAddress: ip, userAgent: ua });
    }
    if (dto.optInWhatsApp !== undefined) {
      consentRows.push({ userId, consentType: 'LOYALTY_MARKETING_WHATSAPP', granted: dto.optInWhatsApp, grantedAt: now, ipAddress: ip, userAgent: ua });
    }
    if (dto.optInPush !== undefined) {
      consentRows.push({ userId, consentType: 'LOYALTY_MARKETING_PUSH', granted: dto.optInPush, grantedAt: now, ipAddress: ip, userAgent: ua });
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.loyaltyMembership.update({ where: { userId }, data });
      if (consentRows.length) {
        await tx.gDPRConsentLog.createMany({ data: consentRows });
      }
      return result;
    });
    return {
      optInEmail: updated.optInEmail,
      optInSms: updated.optInSms,
      optInWhatsApp: updated.optInWhatsApp,
      optInPush: updated.optInPush,
    };
  }

  async getFandomProfile(userId: string) {
    const m = await this.prisma.loyaltyMembership.findUnique({
      where: { userId },
      select: { fandomProfile: true },
    });
    if (!m) throw new NotFoundException('Not enrolled');
    return (m.fandomProfile as Record<string, number> | null) ?? {};
  }

  async getTransactions(userId: string, query: { page?: number; limit?: number }) {
    const membership = await this.prisma.loyaltyMembership.findUnique({ where: { userId } });
    if (!membership) throw new NotFoundException('Not enrolled');
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const [items, total] = await Promise.all([
      this.prisma.loyaltyTransaction.findMany({
        where: { membershipId: membership.id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.loyaltyTransaction.count({ where: { membershipId: membership.id } }),
    ]);
    return { items, total, page, limit };
  }

  async tierProgress(userId: string) {
    const membership = await this.prisma.loyaltyMembership.findUnique({
      where: { userId },
      include: { tier: true },
    });
    if (!membership) throw new NotFoundException('Not enrolled');

    const next = await this.prisma.loyaltyTier.findFirst({
      where: {
        isActive: true,
        inviteOnly: false,
        level: { gt: membership.tier.level },
      },
      orderBy: { level: 'asc' },
    });

    if (!next) {
      return {
        currentTier: membership.tier,
        nextTier: null,
        progressPercent: 100,
        pointsToNext: 0,
      };
    }

    const prevThreshold = membership.tier.pointsThreshold;
    const need = next.pointsThreshold - membership.totalPointsEarned;
    const span = next.pointsThreshold - prevThreshold;
    const gained = membership.totalPointsEarned - prevThreshold;
    const progressPercent = span > 0 ? Math.min(100, Math.max(0, Math.round((gained / span) * 100))) : 0;

    return {
      currentTier: membership.tier,
      nextTier: next,
      progressPercent,
      pointsToNext: Math.max(0, need),
    };
  }

  getRedemptionOptions(region?: string) {
    const now = new Date();
    const where: Prisma.LoyaltyRedemptionOptionWhereInput = {
      isActive: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    };
    if (region) {
      (where.AND as Prisma.LoyaltyRedemptionOptionWhereInput[]).push({
        OR: [{ regionCodes: { isEmpty: true } }, { regionCodes: { has: region } }],
      });
    }
    return this.prisma.loyaltyRedemptionOption.findMany({
      where,
      orderBy: { pointsCost: 'asc' },
    });
  }

  async redeem(userId: string, body: { points: number; channel: string; optionId?: string; storeId?: string }) {
    this.assertEnabled();
    const membership = await this.prisma.loyaltyMembership.findUnique({ where: { userId } });
    if (!membership) throw new NotFoundException('Not enrolled');

    return this.burn.processRedemption({
      membershipId: membership.id,
      points: body.points,
      channel: body.channel as 'MARKETPLACE_CHECKOUT' | 'HOS_OUTLET_POS',
      storeId: body.storeId,
      optionId: body.optionId,
      regionCode: membership.regionCode,
    });
  }

  async referralInfo(userId: string) {
    const membership = await this.prisma.loyaltyMembership.findUnique({
      where: { userId },
      include: { user: { select: { firstName: true, lastName: true } } },
    });
    if (!membership) throw new NotFoundException('Not enrolled');
    const referralCode = await this.referrals.ensureReferralCode(
      membership.id,
      membership.user?.firstName,
    );
    const baseUrl = (this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000').replace(
      /\/$/,
      '',
    );
    const shareUrl = `${baseUrl}/ref/${encodeURIComponent(referralCode)}`;

    const [convertedReferrals, pendingReferrals, totalReferrals, referrerSum] = await Promise.all([
      this.prisma.loyaltyReferral.count({
        where: { referrerId: membership.id, status: 'CONVERTED' },
      }),
      this.prisma.loyaltyReferral.count({
        where: { referrerId: membership.id, status: 'PENDING' },
      }),
      this.prisma.loyaltyReferral.count({ where: { referrerId: membership.id } }),
      this.prisma.loyaltyTransaction.aggregate({
        where: {
          membershipId: membership.id,
          source: 'REFERRAL_REWARD',
        },
        _sum: { points: true },
      }),
    ]);

    const recent = await this.prisma.loyaltyReferral.findMany({
      where: { referrerId: membership.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        referee: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    });

    const recentReferrals = recent.map((r) => ({
      name: r.referee?.user
        ? `${r.referee.user.firstName ?? ''} ${r.referee.user.lastName?.[0] ?? ''}.`.trim() ||
          'Member'
        : 'Pending',
      status: r.status,
      date: r.convertedAt ?? r.createdAt,
      pointsEarned: r.status === 'CONVERTED' ? r.referrerPoints : 0,
    }));

    return {
      referralCode,
      code: referralCode,
      shareUrl,
      totalReferrals,
      convertedReferrals,
      pendingReferrals,
      conversions: convertedReferrals,
      totalPointsEarned: referrerSum._sum.points ?? 0,
      recentReferrals,
    };
  }

  async cardPayload(userId: string) {
    const membership = await this.prisma.loyaltyMembership.findUnique({
      where: { userId },
      include: { tier: true },
    });
    if (!membership) throw new NotFoundException('Not enrolled');
    return {
      cardNumber: membership.cardNumber,
      tier: membership.tier.name,
      balance: membership.currentBalance,
      qrPayload: JSON.stringify({ t: 'hos-loyalty', c: membership.cardNumber, u: userId }),
    };
  }

  async checkIn(userId: string, storeId: string) {
    this.assertEnabled();
    const membership = await this.prisma.loyaltyMembership.findUnique({ where: { userId } });
    if (!membership) throw new NotFoundException('Not enrolled');

    const rule = await this.prisma.loyaltyEarnRule.findFirst({
      where: { action: 'CHECK_IN', isActive: true },
    });
    const pts = rule?.pointsAmount ?? 15;

    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const checkInsToday = await this.prisma.loyaltyTransaction.count({
      where: {
        membershipId: membership.id,
        source: 'CHECK_IN',
        storeId,
        type: LoyaltyTxType.EARN,
        createdAt: { gte: dayStart },
      },
    });
    const maxDay = rule?.maxPerDay ?? 1;
    if (maxDay > 0 && checkInsToday >= maxDay) {
      throw new BadRequestException('Check-in limit reached for this store today');
    }

    await this.prisma.$transaction(async (tx) => {
      await this.wallet.applyDelta(tx, membership.id, pts, LoyaltyTxType.EARN, {
        source: 'CHECK_IN',
        channel: 'STORE',
        storeId,
        description: 'Store check-in',
      });
      await tx.loyaltyMembership.update({
        where: { id: membership.id },
        data: {
          totalPointsEarned: { increment: pts },
          engagementCount: { increment: 1 },
        },
      });
    });

    await this.tiers.recalculateTier(membership.id);
    return { pointsAwarded: pts };
  }

  async lookupMember(query: { email?: string; phone?: string; cardNumber?: string }) {
    this.assertEnabled();
    const where: Prisma.UserWhereInput[] = [];
    if (query.email) where.push({ email: { equals: query.email, mode: 'insensitive' } });
    if (query.phone) where.push({ phone: query.phone });
    if (query.cardNumber) {
      where.push({
        loyaltyMembership: { cardNumber: { equals: query.cardNumber, mode: 'insensitive' } },
      });
    }
    if (!where.length) throw new BadRequestException('Provide email, phone, or cardNumber');

    const user = await this.prisma.user.findFirst({
      where: { OR: where },
      include: {
        loyaltyMembership: { include: { tier: true } },
      },
    });
    if (!user?.loyaltyMembership) throw new NotFoundException('Member not found');
    return {
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      membership: user.loyaltyMembership,
    };
  }

  /**
   * Called inside checkout transaction after parent order is created.
   */
  async finalizeCheckoutRedemption(
    tx: Prisma.TransactionClient,
    userId: string,
    orderId: string,
    points: number,
    optionId: string | null,
    discountAmount: Decimal,
  ): Promise<void> {
    if (points <= 0) return;
    this.assertEnabled();

    const membership = await tx.loyaltyMembership.findUnique({ where: { userId } });
    if (!membership) throw new BadRequestException('No loyalty membership');

    await this.burn.processRedemption({
      membershipId: membership.id,
      points,
      channel: 'MARKETPLACE_CHECKOUT',
      optionId,
      orderId,
      prismaTx: tx,
    });

    await tx.order.update({
      where: { id: orderId },
      data: {
        loyaltyPointsRedeemed: points,
        loyaltyDiscountAmount: discountAmount,
        loyaltyRedemptionChannel: 'MARKETPLACE_CHECKOUT',
      },
    });
  }

  processOrderComplete(orderId: string): Promise<void> {
    return this.earn.processOrderComplete(orderId);
  }

  async validateCartRedemption(userId: string, optionId: string): Promise<{ points: number; discount: Decimal }> {
    this.assertEnabled();
    if (this.config.get<string>('LOYALTY_REDEMPTION_AT_CHECKOUT') !== 'true') {
      throw new BadRequestException('Checkout redemption is not enabled');
    }
    const membership = await this.prisma.loyaltyMembership.findUnique({ where: { userId } });
    if (!membership) throw new BadRequestException('Enroll in The Enchanted Circle to redeem points');

    const opt = await this.prisma.loyaltyRedemptionOption.findFirst({
      where: { id: optionId, isActive: true },
    });
    if (!opt) throw new BadRequestException('Invalid reward');

    const now = new Date();
    if (opt.startsAt && opt.startsAt > now) throw new BadRequestException('Reward is not available yet');
    if (opt.endsAt && opt.endsAt < now) throw new BadRequestException('Reward has expired');
    if (opt.stock != null && opt.stock < 1) throw new BadRequestException('Reward is out of stock');

    if (membership.currentBalance < opt.pointsCost) {
      throw new BadRequestException('Insufficient points');
    }

    const minRedeem = this.config.get<number>('LOYALTY_MIN_REDEMPTION_POINTS', 100);
    if (opt.pointsCost < minRedeem) {
      throw new BadRequestException(`Minimum redemption is ${minRedeem} points`);
    }

    let discount = new Decimal(0);
    if (opt.type === 'DISCOUNT' && opt.value != null) {
      discount = new Decimal(opt.value);
    }

    return { points: opt.pointsCost, discount };
  }

  async clearCartLoyaltyState(cartId: string): Promise<void> {
    await this.prisma.cart.update({
      where: { id: cartId },
      data: {
        pendingLoyaltyPoints: null,
        pendingLoyaltyOptionId: null,
        loyaltyDiscountAmount: new Decimal(0),
      },
    });
  }

  async adminDashboard() {
    const [members, tiers, issued, redeemed] = await Promise.all([
      this.prisma.loyaltyMembership.count(),
      this.prisma.loyaltyTier.findMany({
        where: { isActive: true },
        include: { _count: { select: { members: true } } },
      }),
      this.prisma.loyaltyTransaction.aggregate({
        where: { type: 'EARN' },
        _sum: { points: true },
      }),
      this.prisma.loyaltyTransaction.aggregate({
        where: { type: 'BURN' },
        _sum: { points: true },
      }),
    ]);

    const redeemValue = Number(this.config.get('LOYALTY_DEFAULT_REDEEM_VALUE', 0.01));
    const liability =
      (await this.prisma.loyaltyMembership.aggregate({ _sum: { currentBalance: true } }))._sum
        .currentBalance || 0;

    return {
      totalMembers: members,
      tierDistribution: tiers.map((t) => ({ tier: t.name, count: t._count.members })),
      pointsIssued: issued._sum.points || 0,
      pointsRedeemed: Math.abs(redeemed._sum.points || 0),
      programmeLiabilityEstimate: liability * redeemValue,
    };
  }

  async adminAdjustPoints(userId: string, delta: number, reason?: string) {
    this.assertEnabled();
    const membership = await this.prisma.loyaltyMembership.findUnique({ where: { userId } });
    if (!membership) throw new NotFoundException('Member not found');

    await this.prisma.$transaction(async (tx) => {
      const type = LoyaltyTxType.ADJUST;
      await this.wallet.applyDelta(tx, membership.id, delta, type, {
        source: 'ADMIN',
        channel: 'SYSTEM',
        description: reason || 'Manual adjustment',
      });
      if (delta > 0) {
        await tx.loyaltyMembership.update({
          where: { id: membership.id },
          data: { totalPointsEarned: { increment: delta } },
        });
      }
    });

    await this.tiers.recalculateTier(membership.id);
    return this.getMembership(userId);
  }
}
