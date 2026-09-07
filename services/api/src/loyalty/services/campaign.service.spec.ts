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

  it('does not apply SIGNUP_BONUS points to purchase earn', () => {
    const service = new LoyaltyCampaignService({} as any);
    const result = service.applyCampaignsToBasePoints(
      [
        { id: 'welcome', type: 'SIGNUP_BONUS', multiplier: null, bonusPoints: 2000 },
        {
          id: 'double',
          type: 'MULTIPLIER',
          multiplier: { toNumber: () => 2 },
          bonusPoints: null,
        },
      ],
      100,
    );
    expect(result).toEqual({ points: 200, campaignId: 'double', mult: 2, bonus: 0 });
  });

  it('does not apply PERCENTAGE_OF_QUALIFYING multiplier to base points', () => {
    const service = new LoyaltyCampaignService({} as any);
    const result = service.applyCampaignsToBasePoints(
      [
        {
          id: 'threshold',
          type: 'PERCENTAGE_OF_QUALIFYING',
          multiplier: { toNumber: () => 1 },
          bonusPoints: null,
        },
        {
          id: 'double',
          type: 'MULTIPLIER',
          multiplier: { toNumber: () => 2 },
          bonusPoints: null,
        },
      ],
      100,
    );
    expect(result).toEqual({ points: 200, campaignId: 'double', mult: 2, bonus: 0 });
  });

  it('replaces the default welcome amount with a SIGNUP_BONUS campaign', () => {
    const service = new LoyaltyCampaignService({} as any);
    expect(
      service.resolveSignupAward(
        [{ id: 'ec', name: 'Enchanted Circle', type: 'SIGNUP_BONUS', bonusPoints: 2000 }],
        100,
      ),
    ).toEqual({ points: 2000, campaignId: 'ec', campaignName: 'Enchanted Circle' });
  });

  it('matches POS till enroll against HOS_OUTLET_POS channel aliases', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new LoyaltyCampaignService({ loyaltyBonusCampaign: { findMany } } as any);

    await service.getActiveForContext('US', 'POS');

    const where = findMany.mock.calls[0][0].where;
    const channelClause = where.AND.find(
      (clause: { OR?: Array<{ channelCodes?: unknown }> }) =>
        Array.isArray(clause.OR) && clause.OR.some((entry) => entry.channelCodes),
    );
    expect(channelClause).toEqual({
      OR: [
        { channelCodes: { isEmpty: true } },
        { channelCodes: { hasSome: ['POS', 'HOS_OUTLET_POS'] } },
      ],
    });
  });
});
