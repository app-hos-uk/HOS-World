import { Test } from '@nestjs/testing';
import { LoyaltyAnalyticsController } from './loyalty-analytics.controller';
import { LoyaltyAnalyticsService } from './loyalty-analytics.service';

describe('LoyaltyAnalyticsController', () => {
  let controller: LoyaltyAnalyticsController;
  const analytics = {
    getProgrammeHealth: jest.fn().mockResolvedValue({ totalMembers: 10 }),
    getSnapshotTimeline: jest.fn().mockResolvedValue([]),
    getClvDistribution: jest.fn().mockResolvedValue([]),
    getTopMembersByClv: jest.fn().mockResolvedValue([]),
    getChurnRiskReport: jest.fn().mockResolvedValue({}),
    getCampaignAttributionReport: jest.fn().mockResolvedValue({ campaigns: [], totals: {} }),
    getCampaignRoiTimeline: jest.fn().mockResolvedValue([]),
    getFandomTrends: jest.fn().mockResolvedValue([]),
    getTierAnalysis: jest.fn().mockResolvedValue([]),
    getChannelPerformance: jest.fn().mockResolvedValue({}),
    getCohortRetention: jest.fn().mockResolvedValue([]),
    computeDailySnapshot: jest.fn().mockResolvedValue({}),
    recomputeAllClv: jest.fn().mockResolvedValue({ computed: 5, errors: 0 }),
    exportReport: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await Test.createTestingModule({
      controllers: [LoyaltyAnalyticsController],
      providers: [{ provide: LoyaltyAnalyticsService, useValue: analytics }],
    }).compile();
    controller = mod.get(LoyaltyAnalyticsController);
  });

  it('health', async () => {
    const r = await controller.health();
    expect(r.data).toEqual({ totalMembers: 10 });
  });

  it('snapshots', async () => {
    await controller.snapshots();
    expect(analytics.getSnapshotTimeline).toHaveBeenCalled();
  });

  it('clv distribution', async () => {
    await controller.clvDistribution();
    expect(analytics.getClvDistribution).toHaveBeenCalled();
  });

  it('clv top', async () => {
    await controller.clvTop('10');
    expect(analytics.getTopMembersByClv).toHaveBeenCalledWith(10);
  });

  it('churn', async () => {
    await controller.churn();
    expect(analytics.getChurnRiskReport).toHaveBeenCalled();
  });

  it('attribution', async () => {
    await controller.attribution();
    expect(analytics.getCampaignAttributionReport).toHaveBeenCalled();
  });

  it('fandom trends', async () => {
    await controller.fandomTrends('30');
    expect(analytics.getFandomTrends).toHaveBeenCalledWith(30);
  });

  it('export', async () => {
    await controller.exportReport('clv', 'json');
    expect(analytics.exportReport).toHaveBeenCalledWith('clv', 'json');
  });
});
