import { BadRequestException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { BrandPartnershipsService } from './brand-partnerships.service';

describe('BrandPartnershipsService', () => {
  const prisma = {
    brandPartnership: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    brandCampaign: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    brandCampaignRedemption: {
      findMany: jest.fn(),
      aggregate: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    loyaltyBonusCampaign: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    segmentMembership: { findUnique: jest.fn() },
    orderItem: { findMany: jest.fn() },
    product: { findMany: jest.fn() },
    marketingJourney: { findMany: jest.fn() },
    $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
  };

  const segmentation = { getSegmentUserIds: jest.fn().mockResolvedValue(['u1']) };
  const marketingBus = { emit: jest.fn(), broadcast: jest.fn() };

  let service: BrandPartnershipsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BrandPartnershipsService(
      prisma as any,
      segmentation as any,
      marketingBus as any,
    );
  });

  it('createPartnership rejects invalid contract range', async () => {
    const end = new Date();
    const start = new Date(end.getTime() + 86400000);
    await expect(
      service.createPartnership({
        name: 'A',
        contractStart: start.toISOString(),
        contractEnd: end.toISOString(),
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('createPartnership creates row', async () => {
    prisma.brandPartnership.findUnique.mockResolvedValue(null);
    prisma.brandPartnership.create.mockResolvedValue({
      id: 'p1',
      name: 'A',
      slug: 'a-x',
      contractStart: new Date(),
      contractEnd: new Date(Date.now() + 86400000),
    });
    const start = new Date();
    const end = new Date(start.getTime() + 86400000);
    const r = await service.createPartnership({
      name: 'A',
      contractStart: start.toISOString(),
      contractEnd: end.toISOString(),
    } as any);
    expect(r.id).toBe('p1');
    expect(prisma.brandPartnership.create).toHaveBeenCalled();
  });

  it('reconcileAfterOrder pauses campaign when budget hit', async () => {
    const row = {
      id: 'c1',
      partnershipId: 'p1',
      name: 'C',
      description: null,
      type: 'MULTIPLIER',
      status: 'ACTIVE',
      totalPointsBudget: 100,
      totalPointsAwarded: 100,
      multiplier: null,
      bonusPoints: null,
      regionCodes: [],
      startsAt: new Date(),
      endsAt: new Date(),
      targetFandoms: [],
      targetBrands: [],
      targetCategoryIds: [],
      targetProductIds: [],
      partnership: { id: 'p1', spentBudget: new Decimal(0), totalBudget: new Decimal(9999) },
    };
    prisma.brandCampaign.findUnique.mockResolvedValue(row);
    prisma.brandCampaign.update.mockResolvedValue({ ...row, status: 'PAUSED' });
    prisma.brandPartnership.findUnique.mockResolvedValue({
      id: 'p1',
      spentBudget: new Decimal(0),
      totalBudget: new Decimal(9999),
    });
    prisma.loyaltyBonusCampaign.findFirst.mockResolvedValue(null);
    await service.reconcileAfterOrder('c1');
    expect(prisma.brandCampaign.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'c1' },
        data: { status: 'PAUSED' },
      }),
    );
  });

  it('getDashboard aggregates', async () => {
    prisma.brandPartnership.count.mockResolvedValue(1);
    prisma.brandCampaign.count.mockResolvedValue(2);
    prisma.brandPartnership.findMany.mockResolvedValue([]);
    prisma.brandCampaign.aggregate.mockResolvedValue({
      _sum: { totalPointsAwarded: 50, totalRevenue: new Decimal(10) },
    });
    prisma.brandCampaign.findMany.mockResolvedValue([]);
    const d = await service.getDashboard();
    expect(d).toMatchObject({ totalPartnerships: 1, activeCampaigns: 2 });
  });
});
