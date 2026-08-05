import { LoyaltyEarnEngine } from './earn.engine';

const mockBrandPartnerships = {
  applyBrandOrderBoostInTx: jest.fn().mockResolvedValue({ brandPoints: 0 }),
  reconcileAfterOrder: jest.fn(),
};

const mockProductCampaigns = {
  applyProductCampaignBonusInTx: jest.fn().mockResolvedValue({
    points: 0,
    breakdown: [],
    primaryCampaignId: undefined,
    primaryCampaignName: undefined,
  }),
};

const mockFeatureFlags = {
  isEnabled: jest.fn().mockReturnValue(true),
};

describe('LoyaltyEarnEngine', () => {
  describe('processOrderComplete', () => {
    it('skips when loyalty is disabled', async () => {
      const mockConfig = {
        get: jest.fn().mockReturnValue('false'),
      };
      const flags = { isEnabled: jest.fn().mockReturnValue(true) };
      const engine = new LoyaltyEarnEngine(
        null as any,
        mockConfig as any,
        flags as any,
        null as any,
        null as any,
        null as any,
        mockBrandPartnerships as any,
        mockProductCampaigns as any,
      );
      await engine.processOrderComplete('order-1');
      expect(mockConfig.get).toHaveBeenCalledWith('LOYALTY_ENABLED');
    });

    it('auto-enrolls when no membership exists then continues earn path', async () => {
      const mockConfig = {
        get: jest.fn().mockImplementation((key: string, defaultVal?: any) => {
          if (key === 'LOYALTY_ENABLED') return 'true';
          if (key === 'LOYALTY_DEFAULT_EARN_RATE') return 1;
          if (key === 'LOYALTY_CARD_PREFIX') return 'HOS';
          if (key === 'HOS_SELLER_ID') return '';
          return defaultVal;
        }),
      };
      const createdMembership = {
        id: 'm-new',
        userId: 'u1',
        tier: { multiplier: { toNumber: () => 1 }, level: 1 },
        regionCode: 'GB',
      };
      const mockPrisma = {
        order: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'o1',
            userId: 'u1',
            loyaltyPointsEarned: 0,
            orderNumber: 'ORD-1',
            subtotal: 100,
            items: [
              {
                product: {
                  id: 'p1',
                  sellerId: 's1',
                  isPlatformOwned: false,
                  seller: { id: 's1', loyaltyEnabled: false, loyaltyEarnRate: null },
                  fandom: null,
                  brand: null,
                  categoryId: null,
                },
                price: 100,
                quantity: 1,
              },
            ],
            user: { country: 'GB' },
            clickCollect: null,
          }),
          update: jest.fn(),
        },
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'u1',
            role: 'CUSTOMER',
            country: 'GB',
            currencyPreference: 'USD',
            birthday: null,
          }),
        },
        loyaltyMembership: {
          findUnique: jest
            .fn()
            .mockResolvedValueOnce(null)
            .mockResolvedValue(createdMembership),
          create: jest.fn().mockResolvedValue(createdMembership),
          update: jest.fn(),
        },
        loyaltyTier: {
          findFirst: jest.fn().mockResolvedValue({ id: 'tier-1', slug: 'initiate' }),
        },
        loyaltyEarnRule: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'rule-purchase',
            action: 'PURCHASE',
            isActive: true,
            pointsType: 'PER_CURRENCY_UNIT',
            pointsAmount: 1,
            multiplierStack: true,
          }),
        },
        vendorProduct: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
        loyaltyReferral: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        $transaction: jest.fn(async (fn: (tx: any) => Promise<any>) =>
          fn({
            loyaltyMembership: { update: jest.fn() },
            order: { update: jest.fn() },
            clickCollectOrder: { update: jest.fn() },
          }),
        ),
      };
      const mockWallet = {
        applyDelta: jest.fn().mockResolvedValue({
          balanceBefore: 0,
          balanceAfter: 100,
          applied: true,
        }),
      };
      const mockCampaigns = {
        getActiveForContext: jest.fn().mockResolvedValue([]),
        applyCampaignsToBasePoints: jest.fn().mockReturnValue({
          points: 100,
          campaignId: undefined,
          mult: 1,
          bonus: 0,
        }),
      };
      const mockTiers = { recalculateTier: jest.fn() };

      const engine = new LoyaltyEarnEngine(
        mockPrisma as any,
        mockConfig as any,
        mockFeatureFlags as any,
        mockWallet as any,
        mockCampaigns as any,
        mockTiers as any,
        mockBrandPartnerships as any,
        mockProductCampaigns as any,
      );
      await engine.processOrderComplete('order-1');
      expect(mockPrisma.loyaltyMembership.create).toHaveBeenCalled();
      expect(mockWallet.applyDelta).toHaveBeenCalledWith(
        expect.anything(),
        'm-new',
        100,
        'EARN',
        expect.objectContaining({
          source: 'PURCHASE',
          idempotencyKey: 'earn:PURCHASE:o1:base',
        }),
      );
    });

    it('skips idempotently if order already earned points', async () => {
      const mockConfig = {
        get: jest.fn().mockImplementation((key: string, defaultVal?: any) => {
          if (key === 'LOYALTY_ENABLED') return 'true';
          return defaultVal;
        }),
      };
      const mockPrisma = {
        order: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'o1',
            userId: 'u1',
            loyaltyPointsEarned: 100,
            items: [{ product: { id: 'p1' }, price: 50, quantity: 2 }],
            user: {},
          }),
        },
        loyaltyMembership: {
          findUnique: jest.fn(),
        },
        vendorProduct: {
          findFirst: jest.fn(),
        },
      };

      const engine = new LoyaltyEarnEngine(
        mockPrisma as any,
        mockConfig as any,
        mockFeatureFlags as any,
        null as any,
        null as any,
        null as any,
        mockBrandPartnerships as any,
        mockProductCampaigns as any,
      );
      await engine.processOrderComplete('order-1');
      expect(mockPrisma.loyaltyMembership.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('processPosSale', () => {
    it('skips when sale already earned points', async () => {
      const mockConfig = {
        get: jest.fn().mockImplementation((key: string, defaultVal?: any) => {
          if (key === 'LOYALTY_ENABLED') return 'true';
          return defaultVal;
        }),
      };
      const mockWallet = { applyDelta: jest.fn() };
      const mockPrisma = {
        pOSSale: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'sale-1',
            customerId: 'u1',
            loyaltyPointsEarned: 40,
            items: [{ product: { id: 'p1' }, unitPrice: 20, quantity: 2 }],
            store: {},
          }),
        },
        loyaltyMembership: { findUnique: jest.fn() },
      };

      const engine = new LoyaltyEarnEngine(
        mockPrisma as any,
        mockConfig as any,
        mockFeatureFlags as any,
        mockWallet as any,
        null as any,
        null as any,
        mockBrandPartnerships as any,
        mockProductCampaigns as any,
      );
      await engine.processPosSale('sale-1');
      expect(mockPrisma.loyaltyMembership.findUnique).not.toHaveBeenCalled();
      expect(mockWallet.applyDelta).not.toHaveBeenCalled();
    });

    it('passes stable idempotencyKey on POS earn write', async () => {
      const mockConfig = {
        get: jest.fn().mockImplementation((key: string, defaultVal?: any) => {
          if (key === 'LOYALTY_ENABLED') return 'true';
          if (key === 'LOYALTY_DEFAULT_EARN_RATE') return 1;
          if (key === 'HOS_SELLER_ID') return '';
          return defaultVal;
        }),
      };
      const membership = {
        id: 'm1',
        userId: 'u1',
        tier: { multiplier: { toNumber: () => 1 }, level: 1 },
        regionCode: 'GB',
      };
      const mockWallet = { applyDelta: jest.fn().mockResolvedValue({ applied: true }) };
      const mockPrisma = {
        pOSSale: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'sale-1',
            customerId: 'u1',
            storeId: 'store-1',
            externalSaleId: 'ext-1',
            loyaltyPointsEarned: 0,
            items: [
              {
                product: {
                  id: 'p1',
                  sellerId: 's1',
                  isPlatformOwned: false,
                  seller: { id: 's1', loyaltyEnabled: true, loyaltyEarnRate: null },
                  fandom: null,
                  brand: null,
                  categoryId: null,
                },
                unitPrice: 50,
                quantity: 2,
              },
            ],
            store: {},
          }),
          update: jest.fn(),
        },
        loyaltyMembership: {
          findUnique: jest.fn().mockResolvedValue(membership),
          update: jest.fn(),
        },
        loyaltyEarnRule: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'rule-purchase',
            action: 'PURCHASE',
            isActive: true,
            pointsType: 'PER_CURRENCY_UNIT',
            pointsAmount: 1,
            multiplierStack: true,
          }),
        },
        vendorProduct: { findFirst: jest.fn().mockResolvedValue(null) },
        user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1', country: 'GB' }) },
        $transaction: jest.fn(async (fn: (tx: any) => Promise<any>) =>
          fn({
            loyaltyMembership: { update: jest.fn() },
            pOSSale: { update: jest.fn() },
          }),
        ),
      };
      const mockCampaigns = {
        getActiveForContext: jest.fn().mockResolvedValue([]),
        applyCampaignsToBasePoints: jest.fn().mockReturnValue({
          points: 100,
          campaignId: undefined,
          mult: 1,
          bonus: 0,
        }),
      };
      const mockTiers = { recalculateTier: jest.fn() };

      const engine = new LoyaltyEarnEngine(
        mockPrisma as any,
        mockConfig as any,
        mockFeatureFlags as any,
        mockWallet as any,
        mockCampaigns as any,
        mockTiers as any,
        mockBrandPartnerships as any,
        mockProductCampaigns as any,
      );
      await engine.processPosSale('sale-1');
      expect(mockWallet.applyDelta).toHaveBeenCalledWith(
        expect.anything(),
        'm1',
        100,
        'EARN',
        expect.objectContaining({
          source: 'POS_PURCHASE',
          idempotencyKey: 'earn:POS_PURCHASE:sale-1:base',
        }),
      );
    });
  });
});
