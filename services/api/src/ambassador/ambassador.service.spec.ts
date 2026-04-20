import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { CommissionStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { AmbassadorService } from './ambassador.service';
import { AmbassadorAchievementService } from './achievements/achievement.service';

describe('AmbassadorService', () => {
  let service: AmbassadorService;
  let prisma: any;
  let wallet: any;
  let achievementService: jest.Mocked<Pick<AmbassadorAchievementService, 'grant' | 'checkAndAward'>>;
  let marketingBus: any;
  let loyalty: any;
  let config: any;
  let segmentation: any;

  const membership = (level: number) => ({
    id: 'm1',
    userId: 'u1',
    tier: { level, name: 'T', slug: 't' },
  });

  beforeEach(() => {
    prisma = {
      loyaltyMembership: { findUnique: jest.fn() },
      ambassadorProfile: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        updateMany: jest.fn(),
        aggregate: jest.fn(),
        groupBy: jest.fn(),
      },
      uGCSubmission: {
        create: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      loyaltyTransaction: { aggregate: jest.fn(), findMany: jest.fn(), groupBy: jest.fn() },
      loyaltyReferral: { count: jest.fn(), findMany: jest.fn() },
      ambassadorAchievement: { findMany: jest.fn(), findUnique: jest.fn() },
      influencer: { findUnique: jest.fn() },
      influencerCommission: { findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      $transaction: jest.fn((fn: any) => fn(prisma)),
    };
    wallet = {
      applyDelta: jest.fn().mockResolvedValue({ balanceBefore: 0, balanceAfter: 100 }),
    };
    achievementService = {
      grant: jest.fn().mockResolvedValue(undefined),
      checkAndAward: jest.fn().mockResolvedValue(undefined),
    };
    marketingBus = { emit: jest.fn().mockResolvedValue(undefined) };
    loyalty = { referralInfo: jest.fn().mockResolvedValue({
      totalReferrals: 1,
      convertedReferrals: 0,
      pendingReferrals: 1,
      totalPointsEarned: 0,
      shareUrl: 'http://x/ref/c',
      code: 'c',
    }) };
    config = {
      get: jest.fn((k: string, d?: string) => {
        if (k === 'AMBASSADOR_MIN_TIER_LEVEL') return '4';
        if (k === 'AMBASSADOR_UGC_MAX_PER_WEEK') return '5';
        if (k === 'AMBASSADOR_UGC_FEATURED_BONUS') return '50';
        if (k === 'AMBASSADOR_AUTO_CONVERT_COMMISSION') return 'false';
        return d;
      }),
    };
    segmentation = { touchActivity: jest.fn() };

    service = new AmbassadorService(
      prisma,
      config as any,
      wallet,
      segmentation as any,
      achievementService as any,
      marketingBus,
      loyalty as any,
    );
  });

  it('enroll rejects below min tier level', async () => {
    prisma.loyaltyMembership.findUnique.mockResolvedValue(membership(3));
    await expect(
      service.enroll('u1', { displayName: 'A' } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('enroll rejects duplicate', async () => {
    prisma.loyaltyMembership.findUnique.mockResolvedValue(membership(4));
    prisma.ambassadorProfile.findUnique.mockResolvedValue({ id: 'x' });
    await expect(
      service.enroll('u1', { displayName: 'A' } as any),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('enroll creates profile and grants unlock', async () => {
    prisma.loyaltyMembership.findUnique.mockResolvedValue(membership(4));
    prisma.ambassadorProfile.findUnique.mockResolvedValue(null);
    prisma.ambassadorProfile.create.mockResolvedValue({
      id: 'a1',
      userId: 'u1',
      membershipId: 'm1',
      tier: 'ADVOCATE',
    });
    prisma.ambassadorProfile.findUnique.mockResolvedValueOnce(null).mockResolvedValue({
      id: 'a1',
      achievements: [],
      membership: { tier: { name: 'T', level: 4, slug: 't' } },
    });

    await service.enroll('u1', { displayName: 'Hero' } as any);

    expect(prisma.ambassadorProfile.create).toHaveBeenCalled();
    expect(achievementService.grant).toHaveBeenCalledWith('a1', 'm1', 'u1', 'ambassador-unlocked');
    expect(marketingBus.emit).toHaveBeenCalledWith(
      'AMBASSADOR_ENROLLED',
      'u1',
      expect.any(Object),
    );
  });

  it('submitUgc enforces weekly cap', async () => {
    prisma.ambassadorProfile.findUnique.mockResolvedValue({
      id: 'a1',
      status: 'ACTIVE',
    });
    prisma.uGCSubmission.count.mockResolvedValue(5);
    await expect(
      service.submitUgc('u1', { type: 'PHOTO' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('onLoyaltyReferralConverted updates profile', async () => {
    prisma.ambassadorProfile.findFirst.mockResolvedValue({
      id: 'a1',
      status: 'ACTIVE',
    });
    prisma.ambassadorProfile.update.mockResolvedValue({});
    await service.onLoyaltyReferralConverted('m1');
    expect(prisma.ambassadorProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ totalReferralSignups: { increment: 1 } }),
      }),
    );
  });

  it('convertCommissionToPoints rejects non-APPROVED', async () => {
    prisma.ambassadorProfile.findUnique.mockResolvedValue({
      id: 'a1',
      userId: 'u1',
      membershipId: 'm1',
      status: 'ACTIVE',
      commissionAsPoints: true,
      commissionPointsRate: new Decimal('1.5'),
    });
    prisma.influencer.findUnique.mockResolvedValue({ id: 'inf1', userId: 'u1' });
    prisma.influencerCommission.findFirst.mockResolvedValue({
      id: 'c1',
      status: CommissionStatus.PENDING,
      amount: new Decimal('10'),
      metadata: null,
    });
    await expect(service.convertCommissionToPoints('u1', 'c1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('checkTierProgression upgrades tier when stats qualify', async () => {
    prisma.ambassadorProfile.findUnique.mockResolvedValue({
      id: 'a1',
      userId: 'u1',
      status: 'ACTIVE',
      tier: 'ADVOCATE',
      totalReferralSignups: 5,
      totalUgcApproved: 3,
      totalPointsEarnedAsAmb: 0,
    });
    prisma.ambassadorProfile.update.mockResolvedValue({});
    const r = await service.checkTierProgression('a1');
    expect(r.upgraded).toBe(true);
    expect(r.newTier).toBe('CHAMPION');
  });

  it('eligibility reflects tier gate', async () => {
    prisma.loyaltyMembership.findUnique.mockResolvedValue(membership(4));
    prisma.ambassadorProfile.findUnique.mockResolvedValue(null);
    const e = await service.eligibility('u1');
    expect(e.eligible).toBe(true);
  });

  it('adminDashboard returns aggregates', async () => {
    prisma.ambassadorProfile.count.mockResolvedValue(3);
    prisma.ambassadorProfile.groupBy.mockResolvedValue([{ tier: 'ADVOCATE', _count: { id: 3 } }]);
    prisma.uGCSubmission.count.mockResolvedValue(2);
    prisma.ambassadorProfile.aggregate.mockResolvedValue({ _sum: { totalPointsEarnedAsAmb: 500 } });
    prisma.ambassadorProfile.findMany.mockResolvedValue([]);
    const d = await service.adminDashboard();
    expect(d.totalAmbassadors).toBe(3);
    expect(d.pendingUgc).toBe(2);
  });
});
