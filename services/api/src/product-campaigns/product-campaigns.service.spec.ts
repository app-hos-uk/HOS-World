import { ProductCampaignsService } from './product-campaigns.service';

describe('ProductCampaignsService', () => {
  let service: ProductCampaignsService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      productCampaign: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    service = new ProductCampaignsService(prisma);
  });

  describe('lineMatchesCampaign', () => {
    it('matches product id', () => {
      expect(
        service.lineMatchesCampaign(
          { productId: 'p1', fandom: null, categoryId: null },
          {
            productIds: ['p1'],
            categoryIds: [],
            fandomFilter: [],
            type: 'BONUS_POINTS',
          },
        ),
      ).toBe(true);
    });

    it('matches category', () => {
      expect(
        service.lineMatchesCampaign(
          { productId: 'p1', fandom: null, categoryId: 'c1' },
          {
            productIds: [],
            categoryIds: ['c1'],
            fandomFilter: [],
            type: 'BONUS_POINTS',
          },
        ),
      ).toBe(true);
    });

    it('matches fandom filter', () => {
      expect(
        service.lineMatchesCampaign(
          { productId: 'p1', fandom: 'Harry Potter', categoryId: null },
          {
            productIds: [],
            categoryIds: [],
            fandomFilter: ['Harry Potter'],
            type: 'BONUS_POINTS',
          },
        ),
      ).toBe(true);
    });

    it('returns false when no targeting matches', () => {
      expect(
        service.lineMatchesCampaign(
          { productId: 'p1', fandom: null, categoryId: null },
          {
            productIds: ['p2'],
            categoryIds: [],
            fandomFilter: [],
            type: 'BONUS_POINTS',
          },
        ),
      ).toBe(false);
    });

    it('matches all products when no targeting is specified', () => {
      expect(
        service.lineMatchesCampaign(
          { productId: 'p1', fandom: null, categoryId: null },
          {
            productIds: [],
            categoryIds: [],
            fandomFilter: [],
            type: 'BONUS_POINTS',
          },
        ),
      ).toBe(true);
    });

    it('requires all specified dimensions to match (product id does not bypass fandom)', () => {
      expect(
        service.lineMatchesCampaign(
          { productId: 'p1', fandom: 'Star Wars', categoryId: null },
          {
            productIds: ['p1'],
            categoryIds: [],
            fandomFilter: ['Harry Potter'],
            type: 'BONUS_POINTS',
          },
        ),
      ).toBe(false);
    });
  });

  it('runScheduledActivations updates SCHEDULED campaigns', async () => {
    prisma.productCampaign.updateMany.mockResolvedValue({ count: 2 });
    const n = await service.runScheduledActivations();
    expect(n).toBe(2);
    expect(prisma.productCampaign.updateMany).toHaveBeenCalled();
  });

  it('runExpiredCompletions completes stale campaigns', async () => {
    prisma.productCampaign.updateMany.mockResolvedValue({ count: 3 });
    const n = await service.runExpiredCompletions();
    expect(n).toBe(3);
    expect(prisma.productCampaign.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['ACTIVE', 'SCHEDULED'] },
        }),
      }),
    );
  });

  it('applyProductCampaignBonusInTx sums bonus and increments', async () => {
    const tx = {
      productCampaign: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'camp1',
            name: 'Test',
            minTierLevel: 0,
            regionCodes: [],
            maxRedemptions: null,
            totalRedemptions: 0,
            bonusPoints: 5,
            productIds: ['p1'],
            categoryIds: [],
            fandomFilter: [],
            type: 'BONUS_POINTS',
          },
        ]),
        findUnique: jest.fn().mockResolvedValue({
          id: 'camp1',
          minTierLevel: 0,
          regionCodes: [],
          maxRedemptions: 2,
          totalRedemptions: 0,
          bonusPoints: 5,
          productIds: ['p1'],
          categoryIds: [],
          fandomFilter: [],
          type: 'BONUS_POINTS',
        }),
        update: jest
          .fn()
          .mockResolvedValueOnce({ id: 'camp1', totalRedemptions: 2, maxRedemptions: 2 })
          .mockResolvedValueOnce({ id: 'camp1' }),
      },
    };
    const r = await service.applyProductCampaignBonusInTx(tx as any, {
      tierLevel: 1,
      regionCode: 'GB',
      lines: [{ productId: 'p1', quantity: 2, fandom: null, categoryId: null }],
    });
    expect(r.points).toBe(10);
    expect(tx.productCampaign.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ totalRedemptions: { increment: 2 } }),
      }),
    );
  });

  it('applyProductCampaignBonusInTx skips when max redemptions reached', async () => {
    const tx = {
      productCampaign: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'camp1',
            name: 'Cap',
            minTierLevel: 0,
            regionCodes: [],
            maxRedemptions: 1,
            totalRedemptions: 1,
            bonusPoints: 10,
            productIds: ['p1'],
            categoryIds: [],
            fandomFilter: [],
            type: 'BONUS_POINTS',
          },
        ]),
        findUnique: jest.fn().mockResolvedValue({
          id: 'camp1',
          totalRedemptions: 1,
          maxRedemptions: 1,
          bonusPoints: 10,
          productIds: ['p1'],
          categoryIds: [],
          fandomFilter: [],
          minTierLevel: 0,
          regionCodes: [],
          type: 'BONUS_POINTS',
        }),
      },
    };
    const r = await service.applyProductCampaignBonusInTx(tx as any, {
      tierLevel: 0,
      regionCode: 'GB',
      lines: [{ productId: 'p1', quantity: 1, fandom: null, categoryId: null }],
    });
    expect(r.points).toBe(0);
  });
});
