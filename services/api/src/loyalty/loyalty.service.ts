import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
  Optional,
  Logger,
  OnModuleInit,
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
import { StaffEnrollDto } from './dto/staff-enroll.dto';
import { LoyaltyPreferencesDto } from './dto/loyalty-preferences.dto';
import { MarketingEventBus } from '../journeys/marketing-event.bus';
import { isTruthy } from '../common/utils/config';
import { FeatureFlagsService, FeatureFlag } from '../config/feature-flags.service';
import { isProtectedAdminEmail } from '../config/protected-admin-emails';
import { normalizePhoneToE164 } from '../common/utils/phone-normalize';

@Injectable()
export class LoyaltyService implements OnModuleInit {
  private readonly logger = new Logger(LoyaltyService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private featureFlags: FeatureFlagsService,
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

  async onModuleInit() {
    try {
      const options = await this.prisma.loyaltyRedemptionOption.findMany({
        where: { name: { startsWith: '£' } },
      });
      if (options.length > 0) {
        for (const opt of options) {
          await this.prisma.loyaltyRedemptionOption.update({
            where: { id: opt.id },
            data: { name: opt.name.replace('£', '$') },
          });
        }
        this.logger.log(`Migrated ${options.length} redemption option names from £ to $`);
      }
    } catch (e) {
      this.logger.warn('Failed to migrate redemption option currency symbols', e);
    }
  }

  assertEnabled(): void {
    if (!this.featureFlags.isEnabled(FeatureFlag.LOYALTY_PROGRAMME)) {
      throw new BadRequestException('Loyalty programme is not enabled');
    }
    if (!isTruthy(this.config.get<string>('LOYALTY_ENABLED'))) {
      throw new BadRequestException('Loyalty programme is not enabled');
    }
  }

  isEnabled(): boolean {
    return (
      this.featureFlags.isEnabled(FeatureFlag.LOYALTY_PROGRAMME) &&
      isTruthy(this.config.get<string>('LOYALTY_ENABLED'))
    );
  }

  /** Persist E.164 phoneNormalized when a phone is present and normalisation succeeds. */
  private async ensurePhoneNormalized(
    userId: string,
    phone: string | null | undefined,
    countryHint?: string | null,
  ): Promise<void> {
    if (!phone?.trim()) return;
    const phoneNormalized = normalizePhoneToE164(phone, countryHint);
    if (!phoneNormalized) return;
    await this.prisma.user.update({
      where: { id: userId },
      data: { phoneNormalized },
    });
  }

  async enroll(userId: string, dto?: EnrollLoyaltyDto) {
    this.assertEnabled();
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role !== UserRole.CUSTOMER) {
      throw new BadRequestException('Only customers can enroll');
    }

    if (user.phone && !user.phoneNormalized) {
      await this.ensurePhoneNormalized(userId, user.phone, dto?.regionCode || user.country);
    }

    const existing = await this.prisma.loyaltyMembership.findUnique({
      where: { userId },
      include: { tier: true },
    });

    // Idempotent: already enrolled → still apply referral + repair missing bonuses.
    if (existing) {
      await this.ensureSignupBonus(existing.id, userId);
      try {
        await this.loyaltyListener.onProfileUpdated(userId);
      } catch (profileErr: unknown) {
        this.logger.warn(
          `Profile-complete bonus check failed for ${userId}: ${profileErr instanceof Error ? profileErr.message : 'unknown'}`,
        );
      }
      const ref = dto?.referralCode?.trim();
      let referralStatus: 'applied' | 'already_applied' | 'not_applied' | undefined;
      if (ref) {
        referralStatus = await this.loyaltyListener.onUserRegistered(userId, ref);
      }
      const membership = await this.prisma.loyaltyMembership.findUnique({
        where: { userId },
        include: { tier: true },
      });
      return membership ? { ...membership, referralStatus } : membership;
    }

    const tier = await this.ensureInitiateTier();

    const prefix = this.config.get<string>('LOYALTY_CARD_PREFIX', 'HOS');
    const cardNumber = `${prefix}-${randomBytes(4).toString('hex').toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`;

    const membership = await this.prisma.loyaltyMembership.create({
      data: {
        userId,
        tierId: tier.id,
        regionCode: dto?.regionCode || user.country || 'GB',
        preferredCurrency: dto?.preferredCurrency || user.currencyPreference || 'USD',
        enrollmentChannel: dto?.enrollmentChannel || 'WEB',
        cardNumber,
        // Profile birthday is the source of truth for birthday jobs
        birthday: user.birthday ?? undefined,
      },
      include: { tier: true },
    });

    await this.ensureSignupBonus(membership.id, userId);
    // Customers who already completed profile before enroll still get PROFILE_COMPLETE.
    try {
      await this.loyaltyListener.onProfileUpdated(userId);
    } catch (profileErr: unknown) {
      this.logger.warn(
        `Profile-complete bonus check failed for ${userId}: ${profileErr instanceof Error ? profileErr.message : 'unknown'}`,
      );
    }

    this.events.onWelcome(userId, tier.name).catch((e: unknown) => {
      this.logger.warn(`Welcome event failed for ${userId}: ${e instanceof Error ? e.message : 'unknown'}`);
    });

    void this.marketingBus
      ?.emit('LOYALTY_WELCOME', userId, {
        tierName: tier.name,
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
    let referralStatus: 'applied' | 'already_applied' | 'not_applied' | undefined;
    if (ref) {
      referralStatus = await this.loyaltyListener.onUserRegistered(userId, ref);
    }

    // Return refreshed membership so clients see signup / referral balance immediately.
    const refreshed = await this.prisma.loyaltyMembership.findUnique({
      where: { id: membership.id },
      include: { tier: true },
    });
    return refreshed ? { ...refreshed, referralStatus } : refreshed;
  }

  /**
   * Award the joining (SIGNUP) bonus once per membership.
   * Respects admin earn-rule config: active rule wins; inactive/zero disables;
   * env/default 100 only when no SIGNUP rule exists at all.
   */
  /** @returns true if a new SIGNUP bonus was awarded */
  private async ensureSignupBonus(membershipId: string, userId: string): Promise<boolean> {
    const signupRule = await this.prisma.loyaltyEarnRule.findFirst({
      where: { action: 'SIGNUP', isActive: true },
    });

    let points = 0;
    if (signupRule) {
      points = signupRule.pointsAmount ?? 0;
      if (points <= 0) {
        this.logger.debug(`Signup bonus skipped for user ${userId}: active SIGNUP rule has 0 points`);
        return false;
      }
    } else {
      // If a SIGNUP rule exists but is inactive, treat that as an intentional disable.
      const inactiveSignupRule = await this.prisma.loyaltyEarnRule.findFirst({
        where: { action: 'SIGNUP', isActive: false },
      });
      if (inactiveSignupRule) {
        this.logger.debug(`Signup bonus skipped for user ${userId}: SIGNUP rule is inactive`);
        return false;
      }

      const envBonusRaw = this.config.get<string | number>('LOYALTY_SIGNUP_BONUS');
      const envBonus =
        typeof envBonusRaw === 'number' ? envBonusRaw : Number(envBonusRaw);
      points = Number.isFinite(envBonus) && envBonus > 0 ? envBonus : 100;
      this.logger.warn(
        `No SIGNUP earn rule configured; awarding fallback ${points} pts for user ${userId}`,
      );
    }

    try {
      let awarded = false;
      await this.prisma.$transaction(async (tx) => {
        // Lock + in-tx duplicate check so concurrent getMembership/enroll
        // paths cannot both award the welcome bonus.
        await tx.$executeRaw(
          Prisma.sql`SELECT 1 FROM loyalty_memberships WHERE id = ${membershipId}::uuid FOR UPDATE`,
        );
        const existingSignup = await tx.loyaltyTransaction.findFirst({
          where: { membershipId, source: 'SIGNUP', type: LoyaltyTxType.BONUS },
        });
        if (existingSignup) return;

        await this.wallet.applyDelta(tx, membershipId, points, LoyaltyTxType.BONUS, {
          source: 'SIGNUP',
          channel: 'WEB',
          description: 'Welcome bonus for joining The Enchanted Circle',
        });
        await tx.loyaltyMembership.update({
          where: { id: membershipId },
          data: { totalPointsEarned: { increment: points } },
        });
        awarded = true;
      });
      if (awarded) {
        try {
          await this.tiers.recalculateTier(membershipId);
        } catch (tierErr: unknown) {
          this.logger.warn(
            `Signup bonus awarded but tier recalculation failed for user ${userId}: ${tierErr instanceof Error ? tierErr.message : 'unknown'}`,
          );
        }
      }
      return awarded;
    } catch (signupErr: unknown) {
      this.logger.error(
        `Signup bonus failed for user ${userId}: ${signupErr instanceof Error ? signupErr.message : 'unknown'}`,
        signupErr instanceof Error ? signupErr.stack : undefined,
      );
      return false;
    }
  }

  async getMembership(userId: string) {
    this.assertEnabled();
    await this.ensureInitiateTier();
    const membership = await this.prisma.loyaltyMembership.findUnique({
      where: { userId },
      include: { tier: true },
    });
    // Repair missing joining / profile bonuses for members enrolled before reliability fixes
    if (membership) {
      const awardedSignup = await this.ensureSignupBonus(membership.id, userId);
      let awardedProfile = 0;
      try {
        awardedProfile = await this.loyaltyListener.onProfileUpdated(userId);
      } catch (profileErr: unknown) {
        this.logger.warn(
          `Profile-complete bonus repair failed for ${userId}: ${profileErr instanceof Error ? profileErr.message : 'unknown'}`,
        );
      }
      if (awardedSignup || awardedProfile > 0) {
        return this.prisma.loyaltyMembership.findUnique({
          where: { userId },
          include: { tier: true },
        });
      }
    }
    return membership;
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
    this.assertEnabled();
    const m = await this.prisma.loyaltyMembership.findUnique({
      where: { userId },
      select: { fandomProfile: true },
    });
    if (!m) return {};
    return (m.fandomProfile as Record<string, number> | null) ?? {};
  }

  async getTransactions(userId: string, query: { page?: number; limit?: number }) {
    this.assertEnabled();
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
    this.assertEnabled();
    const membership = await this.prisma.loyaltyMembership.findUnique({
      where: { userId },
      include: { tier: true },
    });
    if (!membership) {
      return { enrolled: false, currentTier: null, nextTier: null, progressPercent: 0, pointsToNext: 0 };
    }

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
    this.assertEnabled();
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
    this.assertEnabled();
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

  /**
   * Staff lookup ladder — stop at first exact hit (never OR across fields):
   * 1. cardNumber exact (case-insensitive)
   * 2. email case-insensitive
   * 3. phoneNormalized — only when exactly one user matches
   */
  async lookupMember(query: { email?: string; phone?: string; cardNumber?: string }) {
    this.assertEnabled();
    const email = query.email?.trim();
    const phone = query.phone?.trim();
    const cardNumber = query.cardNumber?.trim();
    if (!email && !phone && !cardNumber) {
      throw new BadRequestException('Provide email, phone, or cardNumber');
    }

    const memberInclude = {
      loyaltyMembership: { include: { tier: true } },
    } as const;

    if (cardNumber) {
      const byCard = await this.prisma.user.findFirst({
        where: {
          loyaltyMembership: { cardNumber: { equals: cardNumber, mode: 'insensitive' } },
        },
        include: memberInclude,
      });
      if (byCard?.loyaltyMembership) {
        return {
          userId: byCard.id,
          email: byCard.email,
          firstName: byCard.firstName,
          lastName: byCard.lastName,
          membership: byCard.loyaltyMembership,
        };
      }
    }

    if (email) {
      const byEmail = await this.prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        include: memberInclude,
      });
      if (byEmail?.loyaltyMembership) {
        return {
          userId: byEmail.id,
          email: byEmail.email,
          firstName: byEmail.firstName,
          lastName: byEmail.lastName,
          membership: byEmail.loyaltyMembership,
        };
      }
    }

    if (phone) {
      // Lookup accepts E.164 or national with no inventing — try raw E.164 path only (+/00).
      const phoneNormalized = normalizePhoneToE164(phone) ?? normalizePhoneToE164(phone, 'GB');
      if (phoneNormalized) {
        const matches = await this.prisma.user.findMany({
          where: { phoneNormalized },
          include: memberInclude,
          take: 5,
        });
        if (matches.length === 1 && matches[0].loyaltyMembership) {
          const u = matches[0];
          return {
            userId: u.id,
            email: u.email,
            firstName: u.firstName,
            lastName: u.lastName,
            membership: u.loyaltyMembership,
          };
        }
        // 0 or >1 → do not match (shared phones must not return the wrong member)
      }
    }

    throw new NotFoundException('Member not found');
  }

  /**
   * In-store staff enrolment: require email, create/find customer, enroll via POS channel.
   */
  async enrollFromPos(dto: StaffEnrollDto) {
    this.assertEnabled();
    const email = dto.email?.trim();
    if (!email) {
      throw new BadRequestException('Email is required for in-store enrolment');
    }

    const phone = dto.phone?.trim() || null;
    const countryHint = dto.country?.trim() || 'GB';
    const phoneNormalized = phone ? normalizePhoneToE164(phone, countryHint) : null;

    let user = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          password: null,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          phone,
          phoneNormalized,
          country: countryHint,
          role: UserRole.CUSTOMER,
        },
      });
    } else {
      if (user.role !== UserRole.CUSTOMER) {
        throw new BadRequestException('Only customers can enroll');
      }
      const updates: Prisma.UserUpdateInput = {};
      if (dto.firstName?.trim()) updates.firstName = dto.firstName.trim();
      if (dto.lastName?.trim()) updates.lastName = dto.lastName.trim();
      if (phone) {
        updates.phone = phone;
        if (phoneNormalized) updates.phoneNormalized = phoneNormalized;
      } else if (user.phone && !user.phoneNormalized) {
        const existingNorm = normalizePhoneToE164(user.phone, user.country);
        if (existingNorm) updates.phoneNormalized = existingNorm;
      }
      if (Object.keys(updates).length) {
        user = await this.prisma.user.update({ where: { id: user.id }, data: updates });
      }
    }

    const membership = await this.enroll(user.id, { enrollmentChannel: 'POS' });
    if (!membership) {
      throw new NotFoundException('Enrolment failed');
    }

    return {
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      cardNumber: membership.cardNumber,
      qrPayload: JSON.stringify({
        t: 'hos-loyalty',
        c: membership.cardNumber,
        u: user.id,
      }),
      membership,
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
    const [members, tiers, issued, redeemed, earnRuleCount, redemptionOptionCount, campaignCount, balanceAgg] =
      await Promise.all([
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
        this.prisma.loyaltyEarnRule.count({ where: { isActive: true } }),
        this.prisma.loyaltyRedemptionOption.count({ where: { isActive: true } }),
        this.prisma.loyaltyBonusCampaign.count({ where: { isActive: true } }),
        this.prisma.loyaltyMembership.aggregate({ _sum: { currentBalance: true } }),
      ]);

    const redeemValue = Number(this.config.get('LOYALTY_DEFAULT_REDEEM_VALUE', 0.01));
    const liability = balanceAgg._sum.currentBalance ?? 0;

    return {
      totalMembers: members,
      tierCount: tiers.length,
      tierDistribution: tiers.map((t) => ({ tier: t.name, count: t._count.members })),
      earnRuleCount,
      redemptionOptionCount,
      campaignCount,
      pointsIssued: issued._sum.points ?? 0,
      pointsRedeemed: Math.abs(redeemed._sum.points ?? 0),
      totalPointsInCirculation: liability,
      programmeLiabilityEstimate: liability * redeemValue,
    };
  }

  async awardBonus(
    membershipId: string,
    points: number,
    source: string,
    description: string,
  ): Promise<void> {
    if (points <= 0) return;
    const membership = await this.prisma.loyaltyMembership.findUnique({ where: { id: membershipId } });
    if (!membership) return;

    await this.prisma.$transaction(async (tx) => {
      await this.wallet.applyDelta(tx, membershipId, points, LoyaltyTxType.BONUS, {
        source,
        channel: 'WEB',
        description,
      });
      await tx.loyaltyMembership.update({
        where: { id: membershipId },
        data: { totalPointsEarned: { increment: points } },
      });
    });

    await this.tiers.recalculateTier(membershipId);
  }

  async adminAdjustPoints(userId: string, delta: number, reason?: string) {
    this.assertEnabled();
    const membership = await this.prisma.loyaltyMembership.findUnique({ where: { userId } });
    if (!membership) throw new NotFoundException('Loyalty membership not found');

    try {
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
    } catch (err) {
      if (err instanceof BadRequestException || err instanceof NotFoundException) {
        throw err;
      }
      const message = err instanceof Error ? err.message : 'Failed to adjust loyalty points';
      if (/insufficient loyalty balance/i.test(message)) {
        throw new BadRequestException('Insufficient loyalty balance');
      }
      if (/loyalty membership not found/i.test(message)) {
        throw new NotFoundException('Loyalty membership not found');
      }
      this.logger.error(`adminAdjustPoints failed for ${userId}: ${message}`);
      throw new BadRequestException('Failed to adjust loyalty points. Please try again.');
    }

    try {
      await this.tiers.recalculateTier(membership.id);
    } catch (tierErr) {
      this.logger.warn(
        `Tier recalculation failed after adjust for ${userId}: ${tierErr instanceof Error ? tierErr.message : tierErr}`,
      );
    }
    return this.getMembership(userId);
  }

  /**
   * Remove a loyalty membership (and related loyalty data). Optionally delete the
   * underlying user account for test-account cleanup.
   */
  async adminDeleteMember(
    userId: string,
    opts?: { deleteUser?: boolean },
  ): Promise<{ membershipDeleted: boolean; userDeleted: boolean }> {
    const membership = await this.prisma.loyaltyMembership.findUnique({
      where: { userId },
      include: { user: { select: { id: true, email: true, role: true } } },
    });
    if (!membership) throw new NotFoundException('Member not found');

    const user = membership.user;
    const deleteUser = Boolean(opts?.deleteUser);

    if (deleteUser) {
      if (!user) throw new NotFoundException('User not found');
      if (isProtectedAdminEmail(user.email)) {
        throw new BadRequestException('Cannot delete a protected admin user');
      }
      if (user.role === UserRole.ADMIN) {
        throw new BadRequestException('Cannot delete admin users');
      }
      // Orders (and similar) block hard user deletes — fail fast with a clear message.
      const orderCount = await this.prisma.order.count({ where: { userId } });
      if (orderCount > 0) {
        throw new BadRequestException(
          `Cannot delete user account: ${orderCount} order(s) still exist. Uncheck “Also delete user” to remove only the loyalty membership, or delete the user from Admin → Users after clearing related records.`,
        );
      }
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        // Referrals have no onDelete cascade — detach/delete before membership removal.
        await tx.loyaltyReferral.updateMany({
          where: { refereeId: membership.id },
          data: { refereeId: null },
        });
        await tx.loyaltyReferral.deleteMany({
          where: { referrerId: membership.id },
        });
        await tx.loyaltyMembership.delete({
          where: { id: membership.id },
        });
        // Keep user delete in the same transaction so a FK failure rolls membership back too.
        if (deleteUser) {
          await tx.user.delete({ where: { id: userId } });
        }
      });
    } catch (err: unknown) {
      if (err instanceof BadRequestException || err instanceof NotFoundException) {
        throw err;
      }
      const detail = err instanceof Error ? err.message : 'unknown error';
      this.logger.warn(
        `Failed to delete loyalty member ${user?.email || userId}` +
          (deleteUser ? ' (+ user)' : '') +
          `: ${detail}`,
      );
      if (deleteUser) {
        throw new BadRequestException(
          `Delete failed: ${detail}. If the user has related records, uncheck “Also delete user” to remove only the loyalty membership, or clear those records first.`,
        );
      }
      throw new BadRequestException(`Failed to delete loyalty membership: ${detail}`);
    }

    this.logger.warn(
      `Admin deleted loyalty membership for ${user?.email || userId}` +
        (deleteUser ? ' (user account also deleted)' : ''),
    );

    return { membershipDeleted: true, userDeleted: deleteUser };
  }

  /** Ensure the Initiate tier exists; safe under concurrent enrollment. */
  private async ensureInitiateTier() {
    const existing = await this.prisma.loyaltyTier.findFirst({
      where: { slug: 'initiate', isActive: true },
    });
    if (existing) return existing;

    try {
      return await this.prisma.loyaltyTier.create({
        data: {
          name: 'Initiate',
          slug: 'initiate',
          level: 1,
          pointsThreshold: 0,
          multiplier: new Decimal(1),
          benefits: { freeShipping: false, earlyAccessHours: 0 },
          isActive: true,
        },
      });
    } catch {
      const tier = await this.prisma.loyaltyTier.findFirst({
        where: { slug: 'initiate', isActive: true },
      });
      if (tier) return tier;
      throw new BadRequestException('Loyalty tiers not configured');
    }
  }

  /** Bootstrap default tiers when none exist (dev/staging safety net). */
  private async ensureDefaultTiers(): Promise<void> {
    await this.ensureInitiateTier();
  }
}
