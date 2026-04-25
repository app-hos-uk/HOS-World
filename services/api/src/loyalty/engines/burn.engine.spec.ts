import { BadRequestException } from '@nestjs/common';
import { LoyaltyBurnEngine } from './burn.engine';

describe('LoyaltyBurnEngine', () => {
  describe('assertChannelAllowed', () => {
    let engine: LoyaltyBurnEngine;

    beforeEach(() => {
      engine = new LoyaltyBurnEngine(null as any, null as any, null as any);
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
      const mockFindUnique = jest.fn()
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
        $transaction: jest.fn().mockImplementation(async (fn: any) => fn({
          loyaltyMembership: { findUnique: mockFindUnique, update: jest.fn() },
          loyaltyRedemptionOption: { findUnique: mockFindUnique, findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
          loyaltyTransaction: { create: jest.fn() },
          loyaltyRedemption: { create: jest.fn().mockResolvedValue({ id: 'r1' }) },
        })),
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
      const mockFindUnique = jest.fn()
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
        $transaction: jest.fn().mockImplementation(async (fn: any) => fn({
          loyaltyMembership: { findUnique: mockFindUnique, update: jest.fn() },
          loyaltyRedemptionOption: { findUnique: mockFindUnique, findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
          loyaltyTransaction: { create: jest.fn() },
          loyaltyRedemption: { create: jest.fn().mockResolvedValue({ id: 'r1' }) },
        })),
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
});
