import { LoyaltyCampaignService } from './campaign.service';

describe('LoyaltyCampaignService', () => {
  it('excludes store-scoped campaigns when storeId is omitted (web)', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new LoyaltyCampaignService({ loyaltyBonusCampaign: { findMany } } as any);

    await service.getActiveForContext('US', 'WEB');

    const where = findMany.mock.calls[0][0].where;
    expect(where.AND).toEqual(
      expect.arrayContaining([{ storeIds: { isEmpty: true } }]),
    );
  });

  it('includes global and matching store-scoped campaigns when storeId is provided', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new LoyaltyCampaignService({ loyaltyBonusCampaign: { findMany } } as any);

    await service.getActiveForContext('US', 'HOS_OUTLET_POS', 'store-ts');

    const where = findMany.mock.calls[0][0].where;
    const storeClause = where.AND.find(
      (clause: { OR?: Array<{ storeIds?: unknown }> }) =>
        Array.isArray(clause.OR) && clause.OR.some((entry) => entry.storeIds),
    );
    expect(storeClause).toEqual({
      OR: [{ storeIds: { isEmpty: true } }, { storeIds: { has: 'store-ts' } }],
    });
  });
});
