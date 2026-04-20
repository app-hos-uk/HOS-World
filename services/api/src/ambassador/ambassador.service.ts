import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommissionStatus, LoyaltyTxType, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { randomBytes } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { LoyaltyWalletService } from '../loyalty/services/wallet.service';
import { SegmentationService } from '../segmentation/segmentation.service';
import { MarketingEventBus } from '../journeys/marketing-event.bus';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { AmbassadorAchievementService } from './achievements/achievement.service';
import {
  AMBASSADOR_TIERS,
  ambassadorTierIndex,
  evaluateAmbassadorTier,
} from './engines/ambassador-tier.engine';
import { EnrollAmbassadorDto } from './dto/enroll-ambassador.dto';
import { UpdateAmbassadorDto } from './dto/update-ambassador.dto';
import { SubmitUgcDto } from './dto/submit-ugc.dto';
import { ReviewUgcDto } from './dto/review-ugc.dto';

const AMBASSADOR_POINT_SOURCES = [
  'AMBASSADOR_UGC',
  'AMBASSADOR_COMMISSION',
  'AMBASSADOR_ACHIEVEMENT',
  'AMBASSADOR_ENROLL',
];

function startOfIsoWeekLocal(d = new Date()): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfMonthLocal(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

@Injectable()
export class AmbassadorService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    @Inject(forwardRef(() => LoyaltyWalletService))
    private wallet: LoyaltyWalletService,
    private segmentation: SegmentationService,
    private achievementService: AmbassadorAchievementService,
    private marketingBus: MarketingEventBus,
    @Inject(forwardRef(() => LoyaltyService))
    private loyalty: LoyaltyService,
  ) {}

  private minTierLevel(): number {
    return Number(this.config.get<string>('AMBASSADOR_MIN_TIER_LEVEL', '4'));
  }

  private async generateReferralCode(displayName: string): Promise<string> {
    const slug = displayName
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 20)
      .toUpperCase() || 'AMB';
    for (let i = 0; i < 12; i++) {
      const code = `AMB-${slug}-${randomBytes(3).toString('hex').toUpperCase()}`;
      const exists = await this.prisma.ambassadorProfile.findUnique({
        where: { referralCode: code },
        select: { id: true },
      });
      if (!exists) return code;
    }
    return `AMB-${randomBytes(8).toString('hex').toUpperCase()}`;
  }

  private baseUgcPoints(type: string): number {
    const defaults: Record<string, number> = {
      PHOTO: 30,
      VIDEO: 75,
      REVIEW: 40,
      STORY: 50,
      UNBOXING: 60,
      SOCIAL_POST: 25,
    };
    const def = defaults[type] ?? 25;
    return Number(this.config.get<string>(`AMBASSADOR_UGC_POINTS_${type}` as string, String(def)));
  }

  async eligibility(userId: string) {
    const membership = await this.prisma.loyaltyMembership.findUnique({
      where: { userId },
      include: { tier: true },
    });
    if (!membership) {
      return {
        eligible: false,
        currentTier: null,
        requiredTierLevel: this.minTierLevel(),
        enrolled: false,
      };
    }
    const enrolled = !!(await this.prisma.ambassadorProfile.findUnique({
      where: { userId },
      select: { id: true },
    }));
    const min = this.minTierLevel();
    return {
      eligible: membership.tier.level >= min,
      currentTier: { name: membership.tier.name, level: membership.tier.level, slug: membership.tier.slug },
      requiredTierLevel: min,
      enrolled,
    };
  }

  async enroll(userId: string, dto: EnrollAmbassadorDto) {
    const min = this.minTierLevel();
    const membership = await this.prisma.loyaltyMembership.findUnique({
      where: { userId },
      include: { tier: true },
    });
    if (!membership) throw new BadRequestException('Join The Enchanted Circle before becoming an ambassador');
    if (membership.tier.level < min) {
      throw new ForbiddenException(`Ambassador unlock requires loyalty tier level ${min} or higher`);
    }

    const existing = await this.prisma.ambassadorProfile.findUnique({ where: { userId } });
    if (existing) throw new ConflictException('Already enrolled as an ambassador');

    const code = await this.generateReferralCode(dto.displayName);
    const tier0 = AMBASSADOR_TIERS[0];

    const profile = await this.prisma.ambassadorProfile.create({
      data: {
        userId,
        membershipId: membership.id,
        displayName: dto.displayName,
        bio: dto.bio,
        profileImage: dto.profileImage,
        socialLinks: dto.socialLinks as Prisma.InputJsonValue | undefined,
        referralCode: code,
        commissionPointsRate: tier0.commissionPointsRate,
      },
    });

    void this.segmentation.touchActivity(userId);
    await this.achievementService.grant(profile.id, membership.id, userId, 'ambassador-unlocked');

    void this.marketingBus
      .emit('AMBASSADOR_ENROLLED', userId, {
        displayName: dto.displayName,
        tier: profile.tier,
      })
      .catch(() => {});

    await this.achievementService.checkAndAward(profile.id);
    await this.checkTierProgression(profile.id);

    return this.getProfile(userId);
  }

  async getProfile(userId: string) {
    const profile = await this.prisma.ambassadorProfile.findUnique({
      where: { userId },
      include: {
        achievements: { orderBy: { unlockedAt: 'desc' } },
        membership: { include: { tier: true } },
      },
    });
    if (!profile) throw new NotFoundException('Ambassador profile not found');
    return profile;
  }

  async updateProfile(userId: string, dto: UpdateAmbassadorDto) {
    const profile = await this.prisma.ambassadorProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Ambassador profile not found');
    if (profile.status !== 'ACTIVE') throw new ForbiddenException('Ambassador account is not active');

    return this.prisma.ambassadorProfile.update({
      where: { userId },
      data: {
        displayName: dto.displayName ?? undefined,
        bio: dto.bio ?? undefined,
        profileImage: dto.profileImage ?? undefined,
        socialLinks:
          dto.socialLinks !== undefined ? (dto.socialLinks as Prisma.InputJsonValue) : undefined,
        commissionAsPoints:
          dto.commissionAsPoints !== undefined ? dto.commissionAsPoints : undefined,
      },
    });
  }

  async suspendAmbassador(profileId: string) {
    return this.prisma.ambassadorProfile.update({
      where: { id: profileId },
      data: { status: 'SUSPENDED' },
    });
  }

  async reactivateAmbassador(profileId: string) {
    return this.prisma.ambassadorProfile.update({
      where: { id: profileId },
      data: { status: 'ACTIVE' },
    });
  }

  async submitUgc(userId: string, dto: SubmitUgcDto) {
    const profile = await this.prisma.ambassadorProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Ambassador profile not found');
    if (profile.status !== 'ACTIVE') throw new ForbiddenException('Ambassador account is not active');

    const maxWeek = Number(this.config.get<string>('AMBASSADOR_UGC_MAX_PER_WEEK', '5'));
    const weekStart = startOfIsoWeekLocal();
    const weekCount = await this.prisma.uGCSubmission.count({
      where: { ambassadorId: profile.id, createdAt: { gte: weekStart } },
    });
    if (weekCount >= maxWeek) {
      throw new BadRequestException(`Maximum ${maxWeek} UGC submissions per week`);
    }

    const sub = await this.prisma.uGCSubmission.create({
      data: {
        ambassadorId: profile.id,
        userId,
        type: dto.type,
        title: dto.title,
        description: dto.description,
        mediaUrls: dto.mediaUrls ?? [],
        socialUrl: dto.socialUrl,
        platform: dto.platform,
        productId: dto.productId,
        fandomId: dto.fandomId,
      },
    });

    await this.prisma.ambassadorProfile.update({
      where: { id: profile.id },
      data: { totalUgcSubmissions: { increment: 1 }, lastActiveAt: new Date() },
    });
    void this.segmentation.touchActivity(userId);
    return sub;
  }

  async listOwnUgc(
    userId: string,
    filters: { status?: string; page?: number; limit?: number },
  ) {
    const profile = await this.prisma.ambassadorProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Ambassador profile not found');
    return this.listUgcForAmbassador(profile.id, filters);
  }

  async listUgcForAmbassador(
    ambassadorId: string,
    filters: { status?: string; type?: string; page?: number; limit?: number },
  ) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const where: Prisma.UGCSubmissionWhereInput = { ambassadorId };
    if (filters.status) where.status = filters.status;
    if (filters.type) where.type = filters.type;

    const [items, total] = await Promise.all([
      this.prisma.uGCSubmission.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.uGCSubmission.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async listAllUgcAdmin(filters: {
    status?: string;
    type?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const where: Prisma.UGCSubmissionWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.type) where.type = filters.type;

    const [items, total] = await Promise.all([
      this.prisma.uGCSubmission.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          ambassador: { select: { id: true, displayName: true, referralCode: true, userId: true } },
        },
      }),
      this.prisma.uGCSubmission.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async getFeaturedUgc(limit = 12) {
    return this.prisma.uGCSubmission.findMany({
      where: { status: 'FEATURED' },
      orderBy: { featuredAt: 'desc' },
      take: limit,
      include: {
        ambassador: { select: { displayName: true, profileImage: true, referralCode: true } },
      },
    });
  }

  async reviewUgc(submissionId: string, dto: ReviewUgcDto, reviewerId: string) {
    const sub = await this.prisma.uGCSubmission.findUnique({
      where: { id: submissionId },
      include: { ambassador: true },
    });
    if (!sub) throw new NotFoundException('Submission not found');
    if (sub.status !== 'PENDING') throw new BadRequestException('Submission already reviewed');

    if (dto.status === 'REJECTED') {
      return this.prisma.uGCSubmission.update({
        where: { id: submissionId },
        data: {
          status: 'REJECTED',
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          reviewNotes: dto.reviewNotes,
        },
      });
    }

    const base = this.baseUgcPoints(sub.type);
    const featuredExtra = Number(this.config.get<string>('AMBASSADOR_UGC_FEATURED_BONUS', '50'));
    const totalPts = dto.status === 'FEATURED' ? base + featuredExtra : base;

    const membershipId = sub.ambassador.membershipId;
    const userId = sub.ambassador.userId;

    await this.prisma.$transaction(async (tx) => {
      await this.wallet.applyDelta(tx, membershipId, totalPts, LoyaltyTxType.EARN, {
        source: 'AMBASSADOR_UGC',
        sourceId: submissionId,
        channel: 'WEB',
        description: `UGC ${dto.status}: ${sub.type}`,
      });
      await tx.loyaltyMembership.update({
        where: { id: membershipId },
        data: { totalPointsEarned: { increment: totalPts } },
      });
      await tx.ambassadorProfile.update({
        where: { id: sub.ambassadorId },
        data: {
          totalUgcApproved: { increment: 1 },
          totalPointsEarnedAsAmb: { increment: totalPts },
          lastActiveAt: new Date(),
        },
      });
      await tx.uGCSubmission.update({
        where: { id: submissionId },
        data: {
          status: dto.status,
          pointsAwarded: totalPts,
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          reviewNotes: dto.reviewNotes,
          featuredAt: dto.status === 'FEATURED' ? new Date() : null,
        },
      });
    });

    void this.segmentation.touchActivity(userId);

    if (dto.status === 'FEATURED') {
      void this.marketingBus
        .emit('AMBASSADOR_UGC_FEATURED', userId, { ugcType: sub.type, title: sub.title })
        .catch(() => {});
    } else {
      void this.marketingBus
        .emit('AMBASSADOR_UGC_APPROVED', userId, { ugcType: sub.type, pointsAwarded: totalPts })
        .catch(() => {});
    }

    await this.achievementService.checkAndAward(sub.ambassadorId);
    await this.checkTierProgression(sub.ambassadorId);

    return this.prisma.uGCSubmission.findUnique({ where: { id: submissionId } });
  }

  async getReferralDashboard(userId: string) {
    const profile = await this.prisma.ambassadorProfile.findUnique({
      where: { userId },
      include: { membership: { include: { tier: true } } },
    });
    if (!profile) throw new NotFoundException('Ambassador profile not found');

    const loyaltyReferrals = await this.loyalty.referralInfo(userId);

    const influencer = await this.prisma.influencer.findUnique({
      where: { userId },
    });

    let influencerReferrals: Record<string, unknown> | null = null;
    if (influencer) {
      const commissions = await this.prisma.influencerCommission.findMany({
        where: { influencerId: influencer.id },
      });
      const pendingCommission = commissions
        .filter(
          (c) =>
            c.status === CommissionStatus.APPROVED &&
            !(c.metadata as { convertedToPoints?: boolean } | null)?.convertedToPoints,
        )
        .reduce((s, c) => s + c.amount.toNumber(), 0);
      const paidCommission = commissions
        .filter((c) => c.status === CommissionStatus.PAID)
        .reduce((s, c) => s + c.amount.toNumber(), 0);

      influencerReferrals = {
        available: true,
        totalClicks: influencer.totalClicks,
        totalConversions: influencer.totalConversions,
        totalSalesAmount: influencer.totalSalesAmount.toNumber(),
        totalCommission: influencer.totalCommission.toNumber(),
        pendingCommission,
        paidCommission,
      };
    }

    const tierDef = evaluateAmbassadorTier({
      totalReferralSignups: profile.totalReferralSignups,
      totalUgcApproved: profile.totalUgcApproved,
      totalPointsEarnedAsAmb: profile.totalPointsEarnedAsAmb,
    });
    const idx = ambassadorTierIndex(tierDef.slug);
    const nextTier = idx + 1 < AMBASSADOR_TIERS.length ? AMBASSADOR_TIERS[idx + 1] : null;
    const tierProgress = nextTier
      ? {
          referralSignups: {
            current: profile.totalReferralSignups,
            required: nextTier.requirements.minReferralSignups,
          },
          ugcApproved: {
            current: profile.totalUgcApproved,
            required: nextTier.requirements.minApprovedUgc,
          },
          ambassadorPoints: {
            current: profile.totalPointsEarnedAsAmb,
            required: nextTier.requirements.minAmbassadorPoints,
          },
        }
      : null;

    const now = new Date();
    const monthlyTrend: Array<{
      month: string;
      signups: number;
      pointsEarned: number;
      ugcSubmitted: number;
    }> = [];
    for (let i = 5; i >= 0; i--) {
      const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = dt.getFullYear();
      const m = dt.getMonth();
      const start = new Date(y, m, 1);
      const end = new Date(y, m + 1, 1);

      const [signups, txAgg, ugcN] = await Promise.all([
        this.prisma.loyaltyReferral.count({
          where: {
            referrerId: profile.membershipId,
            status: 'CONVERTED',
            convertedAt: { gte: start, lt: end },
          },
        }),
        this.prisma.loyaltyTransaction.aggregate({
          where: {
            membershipId: profile.membershipId,
            createdAt: { gte: start, lt: end },
            OR: [
              { source: { in: AMBASSADOR_POINT_SOURCES } },
              { source: 'REFERRAL_REWARD' },
            ],
          },
          _sum: { points: true },
        }),
        this.prisma.uGCSubmission.count({
          where: { ambassadorId: profile.id, createdAt: { gte: start, lt: end } },
        }),
      ]);

      monthlyTrend.push({
        month: `${y}-${String(m + 1).padStart(2, '0')}`,
        signups,
        pointsEarned: txAgg._sum.points ?? 0,
        ugcSubmitted: ugcN,
      });
    }

    const recentTx = await this.prisma.loyaltyTransaction.findMany({
      where: {
        membershipId: profile.membershipId,
        source: { in: [...AMBASSADOR_POINT_SOURCES, 'REFERRAL_REWARD'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 15,
    });

    const recentAch = await this.prisma.ambassadorAchievement.findMany({
      where: { ambassadorId: profile.id },
      orderBy: { unlockedAt: 'desc' },
      take: 10,
    });

    const recentActivity: Array<{
      type: string;
      description: string;
      pointsEarned: number;
      date: string;
    }> = [];

    for (const t of recentTx) {
      recentActivity.push({
        type:
          t.source === 'REFERRAL_REWARD'
            ? 'REFERRAL_SIGNUP'
            : t.source === 'AMBASSADOR_COMMISSION'
              ? 'COMMISSION_CONVERTED'
              : t.source === 'AMBASSADOR_UGC'
                ? 'UGC_APPROVED'
                : 'OTHER',
        description: t.description || t.source,
        pointsEarned: t.points,
        date: t.createdAt.toISOString(),
      });
    }
    for (const a of recentAch) {
      recentActivity.push({
        type: 'ACHIEVEMENT_UNLOCKED',
        description: a.name,
        pointsEarned: a.pointsAwarded,
        date: a.unlockedAt.toISOString(),
      });
    }
    recentActivity.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
    const trimmedActivity = recentActivity.slice(0, 20);

    return {
      loyaltyReferrals: {
        total: loyaltyReferrals.totalReferrals,
        converted: loyaltyReferrals.convertedReferrals,
        pending: loyaltyReferrals.pendingReferrals,
        totalPointsEarned: loyaltyReferrals.totalPointsEarned,
        shareUrl: loyaltyReferrals.shareUrl,
        code: loyaltyReferrals.code,
      },
      influencerReferrals,
      ambassador: {
        referralCode: profile.referralCode,
        totalReferralSignups: profile.totalReferralSignups,
        totalReferralRevenue: profile.totalReferralRevenue.toNumber(),
        totalPointsEarnedAsAmb: profile.totalPointsEarnedAsAmb,
        tier: profile.tier,
        tierProgress: {
          current: tierDef,
          next: nextTier,
          progress: tierProgress,
        },
      },
      monthlyTrend,
      recentActivity: trimmedActivity,
    };
  }

  async getLeaderboard(period: 'week' | 'month' | 'all', limit = 20) {
    const take = Math.min(100, Math.max(1, limit));

    if (period === 'all') {
      const rows = await this.prisma.ambassadorProfile.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { totalPointsEarnedAsAmb: 'desc' },
        take,
        select: {
          id: true,
          displayName: true,
          profileImage: true,
          tier: true,
          totalPointsEarnedAsAmb: true,
          totalReferralSignups: true,
          totalUgcApproved: true,
          userId: true,
        },
      });
      return rows.map((r, i) => ({
        rank: i + 1,
        displayName: r.displayName,
        profileImage: r.profileImage,
        tier: r.tier,
        points: r.totalPointsEarnedAsAmb,
        referrals: r.totalReferralSignups,
        ugcCount: r.totalUgcApproved,
        userId: r.userId,
      }));
    }

    const start = period === 'week' ? startOfIsoWeekLocal() : startOfMonthLocal();

    const grouped = await this.prisma.loyaltyTransaction.groupBy({
      by: ['membershipId'],
      where: {
        createdAt: { gte: start },
        type: { in: [LoyaltyTxType.EARN, LoyaltyTxType.BONUS] },
        points: { gt: 0 },
        source: { in: AMBASSADOR_POINT_SOURCES },
      },
      _sum: { points: true },
    });

    const ordered = grouped
      .map((g) => ({ membershipId: g.membershipId, points: g._sum.points ?? 0 }))
      .sort((a, b) => b.points - a.points)
      .slice(0, take);

    const memberships = await this.prisma.loyaltyMembership.findMany({
      where: { id: { in: ordered.map((o) => o.membershipId) } },
      select: { id: true, userId: true },
    });
    const memMap = new Map(memberships.map((m) => [m.id, m.userId]));

    const profiles = await this.prisma.ambassadorProfile.findMany({
      where: {
        userId: { in: [...memMap.values()] },
        status: 'ACTIVE',
      },
    });
    const profByUser = new Map(profiles.map((p) => [p.userId, p]));

    return ordered.map((o, i) => {
      const uid = memMap.get(o.membershipId);
      const p = uid ? profByUser.get(uid) : undefined;
      return {
        rank: i + 1,
        displayName: p?.displayName ?? 'Ambassador',
        profileImage: p?.profileImage ?? null,
        tier: p?.tier ?? 'ADVOCATE',
        points: o.points,
        referrals: p?.totalReferralSignups ?? 0,
        ugcCount: p?.totalUgcApproved ?? 0,
        userId: uid,
      };
    });
  }

  async listAchievements(userId: string) {
    const profile = await this.prisma.ambassadorProfile.findUnique({
      where: { userId },
      include: { achievements: { orderBy: { unlockedAt: 'desc' } } },
    });
    if (!profile) throw new NotFoundException('Ambassador profile not found');
    return profile.achievements;
  }

  async convertCommissionToPoints(userId: string, commissionId: string) {
    const profile = await this.prisma.ambassadorProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Ambassador profile not found');
    if (!profile.commissionAsPoints) throw new BadRequestException('Commission-as-points is disabled');
    if (profile.status !== 'ACTIVE') throw new ForbiddenException('Ambassador account is not active');

    const influencer = await this.prisma.influencer.findUnique({ where: { userId } });
    if (!influencer) throw new BadRequestException('No influencer profile linked');

    const commission = await this.prisma.influencerCommission.findFirst({
      where: { id: commissionId, influencerId: influencer.id },
    });
    if (!commission) throw new NotFoundException('Commission not found');
    if (commission.status !== CommissionStatus.APPROVED) {
      throw new BadRequestException('Only approved commissions can be converted');
    }
    const meta = (commission.metadata as { convertedToPoints?: boolean } | null) ?? {};
    if (meta.convertedToPoints) throw new BadRequestException('Commission already converted');

    const rate = profile.commissionPointsRate.toNumber();
    const pointsAwarded = Math.floor(commission.amount.toNumber() * rate * 100);
    if (pointsAwarded <= 0) throw new BadRequestException('No points to award');

    await this.prisma.$transaction(async (tx) => {
      await this.wallet.applyDelta(tx, profile.membershipId, pointsAwarded, LoyaltyTxType.BONUS, {
        source: 'AMBASSADOR_COMMISSION',
        sourceId: commissionId,
        channel: 'WEB',
        description: 'Influencer commission converted to points',
        metadata: { rate, commissionAmount: commission.amount.toString() },
      });
      await tx.loyaltyMembership.update({
        where: { id: profile.membershipId },
        data: { totalPointsEarned: { increment: pointsAwarded } },
      });
      await tx.ambassadorProfile.update({
        where: { id: profile.id },
        data: { totalPointsEarnedAsAmb: { increment: pointsAwarded } },
      });
      await tx.influencerCommission.update({
        where: { id: commissionId },
        data: {
          status: CommissionStatus.PAID,
          metadata: { convertedToPoints: true, pointsAwarded } as Prisma.InputJsonValue,
        },
      });
    });

    void this.segmentation.touchActivity(userId);
    await this.achievementService.checkAndAward(profile.id);
    await this.checkTierProgression(profile.id);

    return { pointsAwarded };
  }

  async tryAutoConvertCommission(commissionId: string): Promise<void> {
    if (this.config.get<string>('AMBASSADOR_AUTO_CONVERT_COMMISSION', 'false') !== 'true') return;

    const commission = await this.prisma.influencerCommission.findUnique({
      where: { id: commissionId },
      include: { influencer: true },
    });
    if (!commission || commission.status !== CommissionStatus.APPROVED) return;

    const profile = await this.prisma.ambassadorProfile.findUnique({
      where: { userId: commission.influencer.userId },
    });
    if (!profile || !profile.commissionAsPoints || profile.status !== 'ACTIVE') return;

    try {
      await this.convertCommissionToPoints(commission.influencer.userId, commissionId);
    } catch {
      /* manual conversion or race */
    }
  }

  async checkTierProgression(ambassadorId: string): Promise<{ upgraded: boolean; newTier: string }> {
    const profile = await this.prisma.ambassadorProfile.findUnique({ where: { id: ambassadorId } });
    if (!profile || profile.status !== 'ACTIVE') {
      return { upgraded: false, newTier: profile?.tier ?? 'ADVOCATE' };
    }

    const next = evaluateAmbassadorTier({
      totalReferralSignups: profile.totalReferralSignups,
      totalUgcApproved: profile.totalUgcApproved,
      totalPointsEarnedAsAmb: profile.totalPointsEarnedAsAmb,
    });

    if (next.slug === profile.tier) {
      return { upgraded: false, newTier: profile.tier };
    }

    const oldTier = profile.tier;
    await this.prisma.ambassadorProfile.update({
      where: { id: ambassadorId },
      data: {
        tier: next.slug,
        commissionPointsRate: next.commissionPointsRate,
      },
    });

    void this.marketingBus
      .emit('AMBASSADOR_TIER_UPGRADE', profile.userId, { oldTier, newTier: next.slug })
      .catch(() => {});

    await this.achievementService.checkAndAward(ambassadorId);
    return { upgraded: true, newTier: next.slug };
  }

  async onLoyaltyReferralConverted(referrerMembershipId: string): Promise<void> {
    const profile = await this.prisma.ambassadorProfile.findFirst({
      where: { membershipId: referrerMembershipId, status: 'ACTIVE' },
    });
    if (!profile) return;

    await this.prisma.ambassadorProfile.update({
      where: { id: profile.id },
      data: { totalReferralSignups: { increment: 1 }, lastActiveAt: new Date() },
    });
    await this.achievementService.checkAndAward(profile.id);
    await this.checkTierProgression(profile.id);
  }

  async incrementInfluencerReferralRevenue(userId: string, orderTotal: Decimal): Promise<void> {
    const profile = await this.prisma.ambassadorProfile.findUnique({ where: { userId } });
    if (!profile) return;
    await this.prisma.ambassadorProfile.update({
      where: { id: profile.id },
      data: { totalReferralRevenue: { increment: orderTotal } },
    });
  }

  async runDailyTierGuardsAndProgression(): Promise<void> {
    const min = this.minTierLevel();
    const profiles = await this.prisma.ambassadorProfile.findMany({
      include: { membership: { include: { tier: true } } },
    });

    for (const p of profiles) {
      const level = p.membership.tier.level;
      const slug = p.membership.tier.slug;

      if (level >= 6 || slug === 'council-of-realms') {
        if (p.status === 'ACTIVE') {
          await this.prisma.ambassadorProfile.update({
            where: { id: p.id },
            data: { status: 'GRADUATED' },
          });
        }
        continue;
      }

      if (level < min && p.status === 'ACTIVE') {
        await this.prisma.ambassadorProfile.update({
          where: { id: p.id },
          data: { status: 'SUSPENDED' },
        });
        continue;
      }

      if (p.status === 'ACTIVE') {
        await this.checkTierProgression(p.id);
      }
    }
  }

  async runAchievementCheckAll(): Promise<void> {
    const active = await this.prisma.ambassadorProfile.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });
    for (const a of active) {
      await this.achievementService.checkAndAward(a.id);
    }
  }

  async adminListAmbassadors(filters: {
    status?: string;
    tier?: string;
    page?: number;
    limit?: number;
    search?: string;
  }) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const where: Prisma.AmbassadorProfileWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.tier) where.tier = filters.tier;
    if (filters.search?.trim()) {
      const q = filters.search.trim();
      where.OR = [
        { displayName: { contains: q, mode: 'insensitive' } },
        { referralCode: { contains: q, mode: 'insensitive' } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
        { user: { firstName: { contains: q, mode: 'insensitive' } } },
        { user: { lastName: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.ambassadorProfile.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
          membership: { select: { id: true, currentBalance: true, tierId: true } },
        },
      }),
      this.prisma.ambassadorProfile.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async adminGetAmbassador(id: string) {
    const profile = await this.prisma.ambassadorProfile.findUnique({
      where: { id },
      include: {
        user: true,
        membership: { include: { tier: true } },
        achievements: { orderBy: { unlockedAt: 'desc' } },
      },
    });
    if (!profile) throw new NotFoundException('Ambassador not found');

    const recentUgc = await this.prisma.uGCSubmission.findMany({
      where: { ambassadorId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    let referralStats: Record<string, unknown> = {};
    try {
      referralStats = (await this.getReferralDashboard(profile.userId)) as unknown as Record<
        string,
        unknown
      >;
    } catch {
      referralStats = {};
    }

    return {
      ...profile,
      recentUgc,
      referralStats,
    };
  }

  async adminDashboard() {
    const [total, byTier, pendingUgc, pointsAgg] = await Promise.all([
      this.prisma.ambassadorProfile.count(),
      this.prisma.ambassadorProfile.groupBy({
        by: ['tier'],
        _count: { id: true },
      }),
      this.prisma.uGCSubmission.count({ where: { status: 'PENDING' } }),
      this.prisma.ambassadorProfile.aggregate({ _sum: { totalPointsEarnedAsAmb: true } }),
    ]);

    const activeThisMonth = await this.prisma.ambassadorProfile.count({
      where: {
        lastActiveAt: { gte: startOfMonthLocal() },
      },
    });

    const top = await this.prisma.ambassadorProfile.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { totalReferralSignups: 'desc' },
      take: 5,
      select: {
        id: true,
        displayName: true,
        referralCode: true,
        totalReferralSignups: true,
        tier: true,
      },
    });

    return {
      totalAmbassadors: total,
      byTier: Object.fromEntries(byTier.map((b) => [b.tier, b._count.id])),
      pendingUgc,
      totalAmbassadorPoints: pointsAgg._sum.totalPointsEarnedAsAmb ?? 0,
      activeThisMonth,
      topReferrers: top,
    };
  }
}
