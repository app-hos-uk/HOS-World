import { BadRequestException } from '@nestjs/common';
import { LoyaltyBurnEngine } from './burn.engine';

const mockFeatureFlags = { isEnabled: jest.fn().mockReturnValue(true) };

describe('LoyaltyBurnEngine', () => {
  describe('assertChannelAllowed', () => {
    let engine: LoyaltyBurnEngine;

    beforeEach(() => {
      engine = new LoyaltyBurnEngine(null as any, null as any, null as any, null as any);
    });

    it('accepts MARKETPLACE_CHECKOUT', () => {
      expect(() => engine.assertChannelAllowed('MARKETPLACE_CHECKOUT')).not.toThrow();
    });

    it('accepts HOS_OUTLET_POS with storeId', () => {
      expect(() => engine.assertChannelAllowed('HOS_OUTLET_POS', 'store-1')).not.toThrow();
    });

    it('rejects unknown channel', () => {
      expect(() => engine.assertChannelAllowed('PARTNER_EXTERNAL')).toThrow(BadRequestException);
    });

    it('rejects HOS_OUTLET_POS without storeId', () => {
      expect(() => engine.assertChannelAllowed('HOS_OUTLET_POS')).toThrow(BadRequestException);
    });
  });

  describe('processRedemption region validation', () => {
    it('rejects redemption if region is not in option.regionCodes', async () => {
      const mockFindUnique = jest
        .fn()
        .mockResolvedValueOnce({ id: 'm1', currentBalance: 1000 })
        .mockResolvedValueOnce({
          id: 'opt1',
          pointsCost: 500,
          type: 'GIFT_CARD',
          isActive: true,
          stock: null,
          regionCodes: ['US', 'CA'],
          channels: [],
          value: null,
        });

      const mockPrisma = {
        $transaction: jest.fn().mockImplementation(async (fn: any) =>
          fn({
            loyaltyMembership: { findUnique: mockFindUnique, update: jest.fn() },
            loyaltyRedemptionOption: {
              findUnique: mockFindUnique,
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            loyaltyTransaction: {
              create: jest.fn(),
              findUnique: jest.fn().mockResolvedValue(null),
            },
            loyaltyRedemption: {
              create: jest.fn().mockResolvedValue({ id: 'r1' }),
              findFirst: jest.fn(),
            },
          }),
        ),
      };

      const mockConfig = {
        get: jest.fn().mockImplementation((key: string, defaultVal?: any) => {
          if (key === 'LOYALTY_ENABLED') return 'true';
          if (key === 'LOYALTY_MIN_REDEMPTION_POINTS') return 100;
          return defaultVal;
        }),
      };

      const engine = new LoyaltyBurnEngine(
        mockPrisma as any,
        null as any,
        mockConfig as any,
        mockFeatureFlags as any,
      );

      await expect(
        engine.processRedemption({
          membershipId: 'm1',
          points: 500,
          channel: 'MARKETPLACE_CHECKOUT',
          optionId: 'opt1',
          regionCode: 'GB',
        }),
      ).rejects.toThrow('not available in your region');
    });

    it('rejects redemption if channel is not in option.channels', async () => {
      const mockFindUnique = jest
        .fn()
        .mockResolvedValueOnce({ id: 'm1', currentBalance: 1000 })
        .mockResolvedValueOnce({
          id: 'opt1',
          pointsCost: 500,
          type: 'GIFT_CARD',
          isActive: true,
          stock: null,
          regionCodes: [],
          channels: ['HOS_OUTLET_POS'],
          value: null,
        });

      const mockPrisma = {
        $transaction: jest.fn().mockImplementation(async (fn: any) =>
          fn({
            loyaltyMembership: { findUnique: mockFindUnique, update: jest.fn() },
            loyaltyRedemptionOption: {
              findUnique: mockFindUnique,
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            loyaltyTransaction: {
              create: jest.fn(),
              findUnique: jest.fn().mockResolvedValue(null),
            },
            loyaltyRedemption: {
              create: jest.fn().mockResolvedValue({ id: 'r1' }),
              findFirst: jest.fn(),
            },
          }),
        ),
      };

      const mockConfig = {
        get: jest.fn().mockImplementation((key: string, defaultVal?: any) => {
          if (key === 'LOYALTY_ENABLED') return 'true';
          if (key === 'LOYALTY_MIN_REDEMPTION_POINTS') return 100;
          return defaultVal;
        }),
      };

      const engine = new LoyaltyBurnEngine(
        mockPrisma as any,
        null as any,
        mockConfig as any,
        mockFeatureFlags as any,
      );

      await expect(
        engine.processRedemption({
          membershipId: 'm1',
          points: 500,
          channel: 'MARKETPLACE_CHECKOUT',
          optionId: 'opt1',
          regionCode: 'GB',
        }),
      ).rejects.toThrow('not available on this channel');
    });
  });

  describe('processRedemption balance', () => {
    it('rejects burn when insufficient balance', async () => {
      const mockWallet = { applyDelta: jest.fn() };
      const mockPrisma = {
        $transaction: jest.fn().mockImplementation(async (fn: any) =>
          fn({
            loyaltyMembership: {
              findUnique: jest.fn().mockResolvedValue({ id: 'm1', currentBalance: 50 }),
              update: jest.fn(),
            },
            loyaltyRedemptionOption: {
              findUnique: jest.fn(),
              findFirst: jest.fn().mockResolvedValue({ id: 'generic-opt' }),
              create: jest.fn(),
              update: jest.fn(),
            },
            loyaltyTransaction: { findUnique: jest.fn().mockResolvedValue(null) },
            loyaltyRedemption: { create: jest.fn(), findFirst: jest.fn() },
          }),
        ),
      };
      const mockConfig = {
        get: jest.fn().mockImplementation((key: string, defaultVal?: any) => {
          if (key === 'LOYALTY_ENABLED') return 'true';
          if (key === 'LOYALTY_MIN_REDEMPTION_POINTS') return 100;
          return defaultVal;
        }),
      };

      const engine = new LoyaltyBurnEngine(
        mockPrisma as any,
        mockWallet as any,
        mockConfig as any,
        mockFeatureFlags as any,
      );

      await expect(
        engine.processRedemption({
          membershipId: 'm1',
          points: 100,
          channel: 'MARKETPLACE_CHECKOUT',
        }),
      ).rejects.toThrow('Insufficient points balance');
      expect(mockWallet.applyDelta).not.toHaveBeenCalled();
    });

    it('returns existing redemption on retry without requiring balance', async () => {
      const mockWallet = { applyDelta: jest.fn() };
      const existing = { id: 'r-existing', couponCode: 'HOS-LYL-ABCD' };
      const mockPrisma = {
        $transaction: jest.fn().mockImplementation(async (fn: any) =>
          fn({
            loyaltyMembership: {
              findUnique: jest.fn().mockResolvedValue({ id: 'm1', currentBalance: 0 }),
              update: jest.fn(),
            },
            loyaltyRedemptionOption: {
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            loyaltyTransaction: { findUnique: jest.fn() },
            loyaltyRedemption: {
              create: jest.fn(),
              findFirst: jest.fn().mockResolvedValue(existing),
            },
          }),
        ),
      };
      const mockConfig = {
        get: jest.fn().mockImplementation((key: string, defaultVal?: any) => {
          if (key === 'LOYALTY_ENABLED') return 'true';
          if (key === 'LOYALTY_MIN_REDEMPTION_POINTS') return 100;
          return defaultVal;
        }),
      };

      const engine = new LoyaltyBurnEngine(
        mockPrisma as any,
        mockWallet as any,
        mockConfig as any,
        mockFeatureFlags as any,
      );

      const result = await engine.processRedemption({
        membershipId: 'm1',
        points: 500,
        channel: 'MARKETPLACE_CHECKOUT',
        optionId: 'opt1',
        orderId: 'order-9',
      });

      expect(result).toEqual({ redemptionId: 'r-existing', couponCode: 'HOS-LYL-ABCD' });
      expect(mockWallet.applyDelta).not.toHaveBeenCalled();
    });

    it('returns the original redemption when a caller idempotency key is replayed', async () => {
      const mockWallet = { applyDelta: jest.fn() };
      const mockPrisma = {
        $transaction: jest.fn().mockImplementation(async (fn: any) =>
          fn({
            loyaltyMembership: {
              findUnique: jest.fn().mockResolvedValue({ id: 'm1', currentBalance: 0 }),
              update: jest.fn(),
            },
            loyaltyRedemptionOption: {
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            loyaltyTransaction: {
              findUnique: jest.fn().mockResolvedValue({
                id: 'tx1',
                sourceId: 'r-first',
                idempotencyKey: 'burn:key:m1:till-1:sale-4821',
              }),
            },
            loyaltyRedemption: {
              create: jest.fn(),
              findFirst: jest.fn(),
              findUnique: jest.fn().mockResolvedValue({
                id: 'r-first',
                couponCode: null,
                status: 'COMPLETED',
              }),
            },
          }),
        ),
      };
      const mockConfig = {
        get: jest.fn().mockImplementation((key: string, defaultVal?: any) => {
          if (key === 'LOYALTY_ENABLED') return 'true';
          if (key === 'LOYALTY_MIN_REDEMPTION_POINTS') return 100;
          return defaultVal;
        }),
      };

      const engine = new LoyaltyBurnEngine(
        mockPrisma as any,
        mockWallet as any,
        mockConfig as any,
        mockFeatureFlags as any,
      );

      const result = await engine.processRedemption({
        membershipId: 'm1',
        points: 500,
        channel: 'MARKETPLACE_CHECKOUT',
        idempotencyKey: 'till-1:sale-4821',
      });

      expect(result).toEqual({ redemptionId: 'r-first', couponCode: undefined });
      expect(mockWallet.applyDelta).not.toHaveBeenCalled();
    });

    it('re-debits and revives redemption when prior burn was REVERSED', async () => {
      const mockWallet = {
        applyDelta: jest.fn().mockResolvedValue({
          balanceBefore: 500,
          balanceAfter: 0,
          applied: true,
        }),
      };
      const redemptionUpdate = jest.fn();
      const membershipUpdate = jest.fn();
      const mockPrisma = {
        store: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'store-1',
            seller: { sellerType: 'PLATFORM_RETAIL' },
          }),
        },
        $transaction: jest.fn().mockImplementation(async (fn: any) =>
          fn({
            loyaltyMembership: {
              findUnique: jest.fn().mockResolvedValue({ id: 'm1', currentBalance: 500 }),
              update: membershipUpdate,
            },
            loyaltyRedemptionOption: {
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            loyaltyTransaction: {
              findUnique: jest
                .fn()
                // first: findRedemptionByWalletKey for original burn key
                .mockResolvedValueOnce({
                  id: 'tx1',
                  sourceId: 'r-first',
                  idempotencyKey: 'burn:key:m1:till-1:sale-4821',
                })
                // second: prior redebit check inside redebitAfterReverse
                .mockResolvedValueOnce(null),
            },
            loyaltyRedemption: {
              create: jest.fn(),
              findFirst: jest.fn(),
              findUnique: jest.fn().mockResolvedValue({
                id: 'r-first',
                couponCode: null,
                status: 'REVERSED',
              }),
              update: redemptionUpdate,
            },
          }),
        ),
      };
      const mockConfig = {
        get: jest.fn().mockImplementation((key: string, defaultVal?: any) => {
          if (key === 'LOYALTY_ENABLED') return 'true';
          if (key === 'LOYALTY_MIN_REDEMPTION_POINTS') return 100;
          return defaultVal;
        }),
      };

      const engine = new LoyaltyBurnEngine(
        mockPrisma as any,
        mockWallet as any,
        mockConfig as any,
        mockFeatureFlags as any,
      );

      const result = await engine.processRedemption({
        membershipId: 'm1',
        points: 500,
        channel: 'HOS_OUTLET_POS',
        storeId: 'store-1',
        idempotencyKey: 'till-1:sale-4821',
      });

      expect(result).toEqual({ redemptionId: 'r-first', couponCode: undefined });
      expect(mockWallet.applyDelta).toHaveBeenCalledWith(
        expect.anything(),
        'm1',
        -500,
        expect.anything(),
        expect.objectContaining({
          idempotencyKey: 'burn:redebit:r-first',
          source: 'REDEMPTION_REDEBIT',
        }),
      );
      expect(redemptionUpdate).toHaveBeenCalledWith({
        where: { id: 'r-first' },
        data: { status: 'COMPLETED' },
      });
      expect(membershipUpdate).toHaveBeenCalled();
    });

    it('heals missing redemption when wallet burn already applied', async () => {
      const mockWallet = {
        applyDelta: jest.fn().mockResolvedValue({
          balanceBefore: 500,
          balanceAfter: 0,
          applied: false,
        }),
      };
      const redemptionCreate = jest.fn().mockResolvedValue({ id: 'r-healed' });
      const membershipUpdate = jest.fn();
      const mockPrisma = {
        $transaction: jest.fn().mockImplementation(async (fn: any) =>
          fn({
            loyaltyMembership: {
              findUnique: jest.fn().mockResolvedValue({ id: 'm1', currentBalance: 0 }),
              update: membershipUpdate,
            },
            loyaltyRedemptionOption: {
              findUnique: jest.fn().mockResolvedValue({
                id: 'opt1',
                pointsCost: 500,
                type: 'DISCOUNT',
                isActive: true,
                stock: 3,
                regionCodes: [],
                channels: [],
                value: 5,
              }),
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            loyaltyTransaction: {
              findUnique: jest.fn().mockResolvedValue({
                id: 'tx1',
                idempotencyKey: 'burn:order:order-9:opt1',
              }),
            },
            loyaltyRedemption: {
              create: redemptionCreate,
              findFirst: jest.fn().mockResolvedValue(null),
            },
          }),
        ),
      };
      const mockConfig = {
        get: jest.fn().mockImplementation((key: string, defaultVal?: any) => {
          if (key === 'LOYALTY_ENABLED') return 'true';
          if (key === 'LOYALTY_MIN_REDEMPTION_POINTS') return 100;
          return defaultVal;
        }),
      };

      const engine = new LoyaltyBurnEngine(
        mockPrisma as any,
        mockWallet as any,
        mockConfig as any,
        mockFeatureFlags as any,
      );

      const result = await engine.processRedemption({
        membershipId: 'm1',
        points: 500,
        channel: 'MARKETPLACE_CHECKOUT',
        optionId: 'opt1',
        orderId: 'order-9',
      });

      expect(result).toEqual({ redemptionId: 'r-healed' });
      expect(membershipUpdate).not.toHaveBeenCalled();
      expect(redemptionCreate).toHaveBeenCalledTimes(1);
      expect(redemptionCreate.mock.calls[0][0].data.couponCode).toBeUndefined();
    });

    it('passes burn:order idempotencyKey for checkout burns', async () => {
      const mockWallet = {
        applyDelta: jest.fn().mockResolvedValue({
          balanceBefore: 500,
          balanceAfter: 0,
          applied: true,
        }),
      };
      const membershipUpdate = jest.fn();
      const redemptionCreate = jest.fn().mockResolvedValue({ id: 'r1' });
      const mockPrisma = {
        $transaction: jest.fn().mockImplementation(async (fn: any) =>
          fn({
            loyaltyMembership: {
              findUnique: jest.fn().mockResolvedValue({ id: 'm1', currentBalance: 500 }),
              update: membershipUpdate,
            },
            loyaltyRedemptionOption: {
              findUnique: jest.fn().mockResolvedValue({
                id: 'opt1',
                pointsCost: 500,
                type: 'DISCOUNT',
                isActive: true,
                stock: null,
                regionCodes: [],
                channels: [],
                value: 5,
              }),
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            loyaltyTransaction: { findUnique: jest.fn().mockResolvedValue(null) },
            loyaltyRedemption: {
              create: redemptionCreate,
              findFirst: jest.fn().mockResolvedValue(null),
            },
            promotion: { create: jest.fn().mockResolvedValue({ id: 'promo-1' }) },
            coupon: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
          }),
        ),
      };
      const mockConfig = {
        get: jest.fn().mockImplementation((key: string, defaultVal?: any) => {
          if (key === 'LOYALTY_ENABLED') return 'true';
          if (key === 'LOYALTY_MIN_REDEMPTION_POINTS') return 100;
          return defaultVal;
        }),
      };

      const engine = new LoyaltyBurnEngine(
        mockPrisma as any,
        mockWallet as any,
        mockConfig as any,
        mockFeatureFlags as any,
      );

      await engine.processRedemption({
        membershipId: 'm1',
        points: 500,
        channel: 'MARKETPLACE_CHECKOUT',
        optionId: 'opt1',
        orderId: 'order-9',
      });

      expect(mockWallet.applyDelta).toHaveBeenCalledWith(
        expect.anything(),
        'm1',
        -500,
        'BURN',
        expect.objectContaining({
          idempotencyKey: 'burn:order:order-9:opt1',
        }),
      );
    });
  });

  describe('DISCOUNT reward coupons', () => {
    const discountOption = {
      id: 'opt-disc',
      pointsCost: 500,
      type: 'DISCOUNT',
      isActive: true,
      stock: null,
      regionCodes: [],
      channels: [],
      value: 5,
    };

    const buildEngine = (overrides: {
      promotionCreate?: jest.Mock;
      couponCreate?: jest.Mock;
      couponFindUnique?: jest.Mock;
      redemptionCreate?: jest.Mock;
    }) => {
      const mockWallet = {
        applyDelta: jest.fn().mockResolvedValue({
          transactionId: 'tx1',
          balanceBefore: 500,
          balanceAfter: 0,
          applied: true,
        }),
      };
      const mockPrisma = {
        $transaction: jest.fn().mockImplementation(async (fn: any) =>
          fn({
            loyaltyMembership: {
              findUnique: jest
                .fn()
                .mockResolvedValue({ id: 'm1', userId: 'user-1', currentBalance: 500 }),
              update: jest.fn(),
            },
            loyaltyRedemptionOption: {
              findUnique: jest.fn().mockResolvedValue(discountOption),
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            loyaltyTransaction: { findUnique: jest.fn().mockResolvedValue(null) },
            loyaltyRedemption: {
              create: overrides.redemptionCreate ?? jest.fn().mockResolvedValue({ id: 'r1' }),
              findFirst: jest.fn().mockResolvedValue(null),
            },
            promotion: {
              create: overrides.promotionCreate ?? jest.fn().mockResolvedValue({ id: 'promo-1' }),
            },
            coupon: {
              findUnique: overrides.couponFindUnique ?? jest.fn().mockResolvedValue(null),
              create: overrides.couponCreate ?? jest.fn(),
            },
          }),
        ),
      };
      const mockConfig = {
        get: jest.fn().mockImplementation((key: string, defaultVal?: any) => {
          if (key === 'LOYALTY_ENABLED') return 'true';
          if (key === 'LOYALTY_MIN_REDEMPTION_POINTS') return 100;
          return defaultVal;
        }),
      };
      const engine = new LoyaltyBurnEngine(
        mockPrisma as any,
        mockWallet as any,
        mockConfig as any,
        mockFeatureFlags as any,
      );
      return { engine, mockWallet };
    };

    it('issues a Promotion + Coupon pair the checkout validator can resolve', async () => {
      const promotionCreate = jest.fn().mockResolvedValue({ id: 'promo-1' });
      const couponCreate = jest.fn();
      const { engine } = buildEngine({ promotionCreate, couponCreate });

      const result = await engine.processRedemption({
        membershipId: 'm1',
        points: 500,
        channel: 'MARKETPLACE_CHECKOUT',
        optionId: 'opt-disc',
      });

      expect(result.couponCode).toMatch(/^HOS-LYL-[0-9A-F]{8}$/);
      expect(promotionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'FIXED_DISCOUNT',
            status: 'ACTIVE',
            actions: { fixedAmount: 5 },
            usageLimit: 1,
            // Locked to the member who spent the points, so a leaked code is worthless.
            conditions: { allowedUserId: 'user-1' },
          }),
        }),
      );
      expect(couponCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            code: result.couponCode,
            promotionId: 'promo-1',
            usageLimit: 1,
            status: 'ACTIVE',
          }),
        }),
      );
    });

    it('does not mint a coupon for a checkout burn — the order is already discounted', async () => {
      const promotionCreate = jest.fn();
      const couponCreate = jest.fn();
      const { engine } = buildEngine({ promotionCreate, couponCreate });

      const result = await engine.processRedemption({
        membershipId: 'm1',
        points: 500,
        channel: 'MARKETPLACE_CHECKOUT',
        optionId: 'opt-disc',
        orderId: 'order-9',
      });

      expect(result.couponCode).toBeUndefined();
      expect(promotionCreate).not.toHaveBeenCalled();
      expect(couponCreate).not.toHaveBeenCalled();
    });

    it('aborts the redemption when the coupon cannot be issued', async () => {
      const couponCreate = jest.fn().mockRejectedValue(new Error('db down'));
      const redemptionCreate = jest.fn();
      const { engine } = buildEngine({ couponCreate, redemptionCreate });

      await expect(
        engine.processRedemption({
          membershipId: 'm1',
          points: 500,
          channel: 'MARKETPLACE_CHECKOUT',
          optionId: 'opt-disc',
        }),
      ).rejects.toThrow(/Could not issue the reward coupon/);
      // No redemption row is written, so the surrounding transaction rolls the
      // burn back rather than leaving the member with a dead code.
      expect(redemptionCreate).not.toHaveBeenCalled();
    });
  });
});
