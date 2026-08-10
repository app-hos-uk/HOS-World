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

const mockRegion = {
  getRegion: jest.fn().mockResolvedValue({
    currency: 'USD',
    country: 'US',
    locale: 'en-US',
    timezone: 'America/New_York',
    taxOrigin: null,
  }),
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
        mockRegion as any,
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
          findUnique: jest.fn().mockResolvedValueOnce(null).mockResolvedValue(createdMembership),
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
        mockRegion as any,
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
        mockRegion as any,
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
        mockRegion as any,
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
        mockRegion as any,
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

    it('falls back to total-based earn when products are unmapped', async () => {
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
        regionCode: null,
      };
      const mockWallet = { applyDelta: jest.fn().mockResolvedValue({ applied: true }) };
      const mockPrisma = {
        pOSSale: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'sale-fallback',
            customerId: 'u1',
            storeId: 'store-1',
            externalSaleId: 'ext-fb',
            loyaltyPointsEarned: 0,
            totalAmount: 100,
            taxAmount: 20,
            items: [
              {
                product: null,
                productId: null,
                unitPrice: 80,
                quantity: 1,
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
        user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1', country: null }) },
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
          points: 80,
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
        mockRegion as any,
      );
      await engine.processPosSale('sale-fallback');

      expect(mockCampaigns.applyCampaignsToBasePoints).toHaveBeenCalledWith([], 80);
      expect(mockBrandPartnerships.applyBrandOrderBoostInTx).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ lines: [] }),
      );
      expect(mockWallet.applyDelta).toHaveBeenCalledWith(
        expect.anything(),
        'm1',
        80,
        'EARN',
        expect.objectContaining({ source: 'POS_PURCHASE' }),
      );
      expect(mockCampaigns.getActiveForContext).toHaveBeenCalledWith('US', 'HOS_OUTLET_POS');
    });

    it('does not fall back when seller opted out of loyalty', async () => {
      const mockConfig = {
        get: jest.fn().mockImplementation((key: string, defaultVal?: any) => {
          if (key === 'LOYALTY_ENABLED') return 'true';
          if (key === 'LOYALTY_DEFAULT_EARN_RATE') return 0;
          if (key === 'HOS_SELLER_ID') return '';
          return defaultVal;
        }),
      };
      const membership = {
        id: 'm1',
        userId: 'u1',
        tier: { multiplier: { toNumber: () => 1 }, level: 1 },
        regionCode: 'US',
      };
      const mockWallet = { applyDelta: jest.fn() };
      const mockPrisma = {
        pOSSale: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'sale-skip',
            customerId: 'u1',
            storeId: 'store-1',
            externalSaleId: 'ext-skip',
            loyaltyPointsEarned: 0,
            totalAmount: 100,
            taxAmount: 20,
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
        },
        loyaltyEarnRule: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
        vendorProduct: { findFirst: jest.fn().mockResolvedValue(null) },
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
        mockRegion as any,
      );
      await engine.processPosSale('sale-skip');

      expect(mockPrisma.pOSSale.update).toHaveBeenCalledWith({
        where: { id: 'sale-skip' },
        data: { loyaltyPointsEarned: 0 },
      });
      expect(mockWallet.applyDelta).not.toHaveBeenCalled();
    });

    it('awards zero points when sale total equals tax (zero net)', async () => {
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
        regionCode: 'US',
      };
      const mockWallet = { applyDelta: jest.fn() };
      const mockPrisma = {
        pOSSale: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'sale-zero',
            customerId: 'u1',
            storeId: 'store-1',
            externalSaleId: 'ext-zero',
            loyaltyPointsEarned: 0,
            totalAmount: 50,
            taxAmount: 50,
            items: [
              {
                product: null,
                unitPrice: 50,
                quantity: 1,
              },
            ],
            store: {},
          }),
          update: jest.fn(),
        },
        loyaltyMembership: {
          findUnique: jest.fn().mockResolvedValue(membership),
        },
        loyaltyEarnRule: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
        vendorProduct: { findFirst: jest.fn().mockResolvedValue(null) },
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
        mockRegion as any,
      );
      await engine.processPosSale('sale-zero');

      expect(mockPrisma.pOSSale.update).toHaveBeenCalledWith({
        where: { id: 'sale-zero' },
        data: { loyaltyPointsEarned: 0 },
      });
      expect(mockWallet.applyDelta).not.toHaveBeenCalled();
    });
  });

  describe('reversePosSaleEarn', () => {
    const mockConfig = {
      get: jest.fn().mockImplementation((key: string, defaultVal?: any) => {
        if (key === 'LOYALTY_ENABLED') return 'true';
        return defaultVal;
      }),
    };

    const buildEngine = (balance: number, totalPointsEarned = 500, purchaseCount = 3) => {
      const membershipUpdate = jest.fn();
      const saleUpdate = jest.fn();
      const mockWallet = {
        applyDelta: jest.fn().mockResolvedValue({ applied: true }),
        lockMembership: jest.fn().mockResolvedValue(undefined),
      };
      const mockPrisma = {
        pOSSale: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'sale-1',
            customerId: 'u1',
            storeId: 'store-1',
            externalSaleId: 'ext-1',
            loyaltyPointsEarned: 100,
          }),
        },
        loyaltyMembership: { findUnique: jest.fn().mockResolvedValue({ id: 'm1' }) },
        $transaction: jest.fn(async (fn: (tx: any) => Promise<any>) =>
          fn({
            loyaltyMembership: {
              findUnique: jest
                .fn()
                .mockResolvedValue({ currentBalance: balance, totalPointsEarned, purchaseCount }),
              update: membershipUpdate,
            },
            pOSSale: { update: saleUpdate },
          }),
        ),
      };
      const mockTiers = { recalculateTier: jest.fn() };
      const engine = new LoyaltyEarnEngine(
        mockPrisma as any,
        mockConfig as any,
        mockFeatureFlags as any,
        mockWallet as any,
        { getActiveForContext: jest.fn(), applyCampaignsToBasePoints: jest.fn() } as any,
        mockTiers as any,
        mockBrandPartnerships as any,
        mockProductCampaigns as any,
        mockRegion as any,
      );
      return { engine, mockWallet, membershipUpdate, saleUpdate, mockTiers };
    };

    it('claws back the full earn when the balance still covers it', async () => {
      const { engine, mockWallet, saleUpdate } = buildEngine(400);
      await engine.reversePosSaleEarn('sale-1');

      expect(mockWallet.applyDelta).toHaveBeenCalledWith(
        expect.anything(),
        'm1',
        -100,
        'ADJUST',
        expect.objectContaining({
          source: 'POS_SALE_VOID',
          idempotencyKey: 'reverse:POS_PURCHASE:sale-1',
        }),
      );
      expect(saleUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: { loyaltyPointsEarned: 0 } }),
      );
    });

    it('caps the clawback at the live balance instead of failing the void', async () => {
      const { engine, mockWallet, membershipUpdate, saleUpdate } = buildEngine(30);
      await engine.reversePosSaleEarn('sale-1');

      expect(mockWallet.applyDelta).toHaveBeenCalledWith(
        expect.anything(),
        'm1',
        -30,
        'ADJUST',
        expect.objectContaining({
          metadata: expect.objectContaining({ earnedPoints: 100, clawedPoints: 30 }),
        }),
      );
      expect(membershipUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: { totalPointsEarned: { decrement: 30 } } }),
      );
      expect(saleUpdate).toHaveBeenCalled();
    });

    it('still completes the void when the points are fully spent', async () => {
      const { engine, mockWallet, membershipUpdate, saleUpdate } = buildEngine(0);
      await engine.reversePosSaleEarn('sale-1');

      expect(mockWallet.applyDelta).not.toHaveBeenCalled();
      // purchaseCount is still corrected even though no points could be taken.
      expect(membershipUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: { purchaseCount: { decrement: 1 } } }),
      );
      expect(saleUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: { loyaltyPointsEarned: 0 } }),
      );
    });
  });
});
