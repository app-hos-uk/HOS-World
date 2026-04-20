import { LoyaltyAnalyticsService } from './loyalty-analytics.service';
import { Decimal } from '@prisma/client/runtime/library';

describe('LoyaltyAnalyticsService', () => {
  const membership = {
    id: 'm1', userId: 'u1', engagementCount: 5, enrolledAt: new Date(Date.now() - 180 * 86400000),
    purchaseCount: 10, totalSpend: new Decimal(500),
    tier: { level: 3, multiplier: new Decimal(1.5), name: 'Enchanter' },
  };

  const prisma: any = {
    loyaltyMembership: {
      count: jest.fn().mockResolvedValue(10),
      findMany: jest.fn().mockResolvedValue([{ id: 'm1' }]),
      findUnique: jest.fn().mockResolvedValue(membership),
      aggregate: jest.fn().mockResolvedValue({ _sum: { currentBalance: 5000 }, _avg: { clvScore: new Decimal(100), predictedChurnRisk: new Decimal(0.2) }, _count: 10 }),
      update: jest.fn().mockResolvedValue({}),
    },
    loyaltyTransaction: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { points: 1000 }, _count: 5 }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    loyaltyTier: {
      findMany: jest.fn().mockResolvedValue([
        { id: 't1', name: 'Initiate', level: 1, isActive: true, multiplier: new Decimal(1), _count: { members: 5 } },
      ]),
    },
    loyaltyAnalyticsSnapshot: { upsert: jest.fn().mockImplementation((_a: any) => Promise.resolve({})), findMany: jest.fn().mockResolvedValue([]) },
    loyaltyBonusCampaign: { findUnique: jest.fn().mockResolvedValue({ name: 'Summer' }) },
    brandCampaign: { findUnique: jest.fn().mockResolvedValue(null) },
    campaignAttribution: { upsert: jest.fn().mockResolvedValue({}), findMany: jest.fn().mockResolvedValue([]) },
    order: { findMany: jest.fn().mockResolvedValue([{ subtotal: new Decimal(50), createdAt: new Date() }]), aggregate: jest.fn().mockResolvedValue({ _sum: { subtotal: new Decimal(500) }, _count: 10 }) },
    orderItem: { findMany: jest.fn().mockResolvedValue([]), groupBy: jest.fn().mockResolvedValue([]) },
    pOSSale: { aggregate: jest.fn().mockResolvedValue({ _sum: { totalAmount: new Decimal(200) }, _count: 5 }) },
    segmentMembership: {},
  };

  const config: any = { get: jest.fn().mockImplementation((_k: string, def?: unknown) => def ?? '200') };
  let service: LoyaltyAnalyticsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LoyaltyAnalyticsService(prisma, config);
  });

  it('computeDailySnapshot upserts', async () => {
    await service.computeDailySnapshot(new Date());
    expect(prisma.loyaltyAnalyticsSnapshot.upsert).toHaveBeenCalled();
  });

  it('getSnapshotTimeline returns array', async () => {
    const r = await service.getSnapshotTimeline(new Date(), new Date());
    expect(Array.isArray(r)).toBe(true);
  });

  it('computeClvForMember stores values', async () => {
    const r = await service.computeClvForMember('m1');
    expect(r.clvScore).toBeGreaterThanOrEqual(0);
    expect(prisma.loyaltyMembership.update).toHaveBeenCalled();
  });

  it('recomputeAllClv processes batch', async () => {
    prisma.loyaltyMembership.findMany
      .mockResolvedValueOnce([{ id: 'm1' }])
      .mockResolvedValueOnce([]);
    const r = await service.recomputeAllClv(10);
    expect(r.computed).toBeGreaterThanOrEqual(0);
  });

  it('getClvDistribution returns buckets', async () => {
    const r = await service.getClvDistribution();
    expect(r.length).toBe(4);
  });

  it('getTopMembersByClv returns array', async () => {
    prisma.loyaltyMembership.findMany.mockResolvedValueOnce([{
      id: 'm1', userId: 'u1', clvScore: new Decimal(100), totalSpend: new Decimal(500),
      purchaseCount: 10, tier: { name: 'Enchanter' }, user: { firstName: 'A', lastName: 'B', email: 'a@b.c' },
    }]);
    const r = await service.getTopMembersByClv();
    expect(r.length).toBe(1);
  });

  it('getChurnRiskReport separates risk levels', async () => {
    prisma.loyaltyMembership.count.mockResolvedValueOnce(2).mockResolvedValueOnce(5).mockResolvedValueOnce(1);
    prisma.loyaltyMembership.findMany.mockResolvedValueOnce([]);
    const r: any = await service.getChurnRiskReport();
    expect(r.atRisk).toBe(2);
    expect(r.healthy).toBe(5);
  });

  it('computeAttributionForDate processes transactions', async () => {
    prisma.loyaltyTransaction.findMany.mockResolvedValueOnce([
      { campaignId: 'c1', points: 100, sourceId: 'o1', source: 'PURCHASE', membership: { userId: 'u1' } },
    ]);
    const n = await service.computeAttributionForDate(new Date());
    expect(n).toBe(1);
    expect(prisma.campaignAttribution.upsert).toHaveBeenCalled();
  });

  it('getCampaignAttributionReport aggregates', async () => {
    const r: any = await service.getCampaignAttributionReport({});
    expect(r.campaigns).toBeDefined();
    expect(r.totals).toBeDefined();
  });

  it('getCampaignRoiTimeline returns daily', async () => {
    const r = await service.getCampaignRoiTimeline('c1');
    expect(Array.isArray(r)).toBe(true);
  });

  it('getProgrammeHealth returns KPIs', async () => {
    prisma.loyaltyMembership.count.mockResolvedValue(10);
    prisma.order.findMany.mockResolvedValue([]);
    const r: any = await service.getProgrammeHealth();
    expect(r.totalMembers).toBeDefined();
    expect(r.pointsLiability).toBeDefined();
  });

  it('getChannelPerformance returns web and pos', async () => {
    const r: any = await service.getChannelPerformance();
    expect(r.web).toBeDefined();
    expect(r.pos).toBeDefined();
  });
});
