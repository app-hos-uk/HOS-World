import { Decimal } from '@prisma/client/runtime/library';
import { LoyaltyTierEngine } from './tier.engine';

describe('LoyaltyTierEngine', () => {
  describe('compositeScore', () => {
    it('weights spend, frequency and engagement correctly', () => {
      const engine = new LoyaltyTierEngine(null as any, null as any);
      const score = engine.compositeScore({
        totalSpend: new Decimal(500),
        purchaseCount: 10,
        engagementCount: 5,
        tier: {
          spendWeight: new Decimal(0.4),
          frequencyWeight: new Decimal(0.35),
          engagementWeight: new Decimal(0.25),
        },
      });

      // 500 * 0.4 = 200
      // 10 * 0.35 * 100 = 350
      // 5 * 0.25 * 50 = 62.5
      // total = 612.5
      expect(score.toNumber()).toBe(612.5);
    });
  });

  describe('recalculateTier', () => {
    it('upgrades member when enough points are earned', async () => {
      const silverTier = { id: 'silver', name: 'Silver', slug: 'silver', level: 2, isActive: true, inviteOnly: false, pointsThreshold: 500, spendWeight: new Decimal(0.4), frequencyWeight: new Decimal(0.35), engagementWeight: new Decimal(0.25) };
      const initiateTier = { id: 'initiate', name: 'Initiate', slug: 'initiate', level: 1, isActive: true, inviteOnly: false, pointsThreshold: 0, spendWeight: new Decimal(0.4), frequencyWeight: new Decimal(0.35), engagementWeight: new Decimal(0.25) };

      const mockPrisma = {
        loyaltyMembership: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'm1',
            userId: 'u1',
            tierId: 'initiate',
            totalPointsEarned: 600,
            totalSpend: new Decimal(100),
            purchaseCount: 3,
            engagementCount: 1,
            tier: initiateTier,
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        loyaltyTier: {
          findMany: jest.fn().mockResolvedValue([silverTier, initiateTier]),
        },
      };

      const mockEvents = {
        onTierChange: jest.fn().mockResolvedValue(undefined),
      };

      const engine = new LoyaltyTierEngine(mockPrisma as any, mockEvents as any);
      const result = await engine.recalculateTier('m1');

      expect(result.upgraded).toBe(true);
      expect(result.tierId).toBe('silver');
      expect(mockEvents.onTierChange).toHaveBeenCalledWith(
        expect.objectContaining({
          membershipId: 'm1',
          userId: 'u1',
          oldTierName: 'Initiate',
          newTierName: 'Silver',
        }),
      );
    });

    it('skips invite-only tiers', async () => {
      const inviteTier = { id: 'inner-circle', name: 'Inner Circle', slug: 'inner-circle', level: 6, isActive: true, inviteOnly: true, pointsThreshold: 50000, spendWeight: new Decimal(0.4), frequencyWeight: new Decimal(0.35), engagementWeight: new Decimal(0.25) };
      const adeptTier = { id: 'adept', name: 'Adept', slug: 'adept', level: 3, isActive: true, inviteOnly: false, pointsThreshold: 2000, spendWeight: new Decimal(0.4), frequencyWeight: new Decimal(0.35), engagementWeight: new Decimal(0.25) };
      const initiateTier = { id: 'initiate', name: 'Initiate', slug: 'initiate', level: 1, isActive: true, inviteOnly: false, pointsThreshold: 0, spendWeight: new Decimal(0.4), frequencyWeight: new Decimal(0.35), engagementWeight: new Decimal(0.25) };

      const mockPrisma = {
        loyaltyMembership: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'm1',
            userId: 'u1',
            tierId: 'initiate',
            totalPointsEarned: 100000,
            totalSpend: new Decimal(1000),
            purchaseCount: 50,
            engagementCount: 20,
            tier: initiateTier,
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        loyaltyTier: {
          findMany: jest.fn().mockResolvedValue([inviteTier, adeptTier, initiateTier]),
        },
      };

      const mockEvents = {
        onTierChange: jest.fn().mockResolvedValue(undefined),
      };

      const engine = new LoyaltyTierEngine(mockPrisma as any, mockEvents as any);
      const result = await engine.recalculateTier('m1');

      expect(result.upgraded).toBe(true);
      expect(result.tierId).toBe('adept');
    });
  });
});
