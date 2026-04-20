import { LoyaltyEarnEngine } from './earn.engine';
import { Decimal } from '@prisma/client/runtime/library';

const mockBrandPartnerships = {
  applyBrandOrderBoostInTx: jest.fn().mockResolvedValue({ brandPoints: 0 }),
  reconcileAfterOrder: jest.fn(),
};

describe('LoyaltyEarnEngine', () => {
  describe('processOrderComplete', () => {
    it('skips when loyalty is disabled', async () => {
      const mockConfig = {
        get: jest.fn().mockReturnValue('false'),
      };
      const engine = new LoyaltyEarnEngine(
        null as any,
        mockConfig as any,
        null as any,
        null as any,
        null as any,
        mockBrandPartnerships as any,
      );
      await engine.processOrderComplete('order-1');
      expect(mockConfig.get).toHaveBeenCalledWith('LOYALTY_ENABLED');
    });

    it('skips when no membership exists', async () => {
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
            items: [{ product: { id: 'p1', sellerId: 's1', isPlatformOwned: false, seller: null }, price: 100, quantity: 1 }],
            user: {},
          }),
          update: jest.fn(),
        },
        loyaltyMembership: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
        vendorProduct: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      };

      const engine = new LoyaltyEarnEngine(
        mockPrisma as any,
        mockConfig as any,
        null as any,
        null as any,
        null as any,
        mockBrandPartnerships as any,
      );
      await engine.processOrderComplete('order-1');
      expect(mockPrisma.loyaltyMembership.findUnique).toHaveBeenCalled();
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
        null as any,
        null as any,
        null as any,
        mockBrandPartnerships as any,
      );
      await engine.processOrderComplete('order-1');
      expect(mockPrisma.loyaltyMembership.findUnique).not.toHaveBeenCalled();
    });
  });
});
