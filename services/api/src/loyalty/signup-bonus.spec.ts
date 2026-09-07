import {
  enrollmentChannelAliases,
  isSignupBonusCampaign,
  purchaseEarnCampaigns,
  resolveSignupCampaignAward,
  SIGNUP_BONUS_CAMPAIGN_TYPE,
} from './signup-bonus';

describe('signup-bonus', () => {
  it('treats POS and HOS_OUTLET_POS as the same enrollment source', () => {
    expect(enrollmentChannelAliases('POS')).toEqual(['POS', 'HOS_OUTLET_POS']);
    expect(enrollmentChannelAliases('hos_outlet_pos')).toEqual(['POS', 'HOS_OUTLET_POS']);
  });

  it('identifies SIGNUP_BONUS campaigns', () => {
    expect(isSignupBonusCampaign({ type: SIGNUP_BONUS_CAMPAIGN_TYPE })).toBe(true);
    expect(isSignupBonusCampaign({ type: 'MULTIPLIER' })).toBe(false);
  });

  it('excludes SIGNUP_BONUS and PERCENTAGE_OF_QUALIFYING from purchase earn', () => {
    const kept = purchaseEarnCampaigns([
      { id: 'a', type: 'MULTIPLIER', bonusPoints: 10 },
      { id: 'b', type: SIGNUP_BONUS_CAMPAIGN_TYPE, bonusPoints: 2000 },
      { id: 'c', type: 'PERCENTAGE_OF_QUALIFYING', bonusPoints: 0 },
    ]);
    expect(kept).toEqual([{ id: 'a', type: 'MULTIPLIER', bonusPoints: 10 }]);
  });

  it('maps AUTO_PURCHASE to WEB alias for repair path', () => {
    expect(enrollmentChannelAliases('AUTO_PURCHASE')).toEqual(['WEB', 'AUTO_PURCHASE']);
  });

  it('uses the highest matching welcome campaign instead of the earn-rule fallback', () => {
    expect(
      resolveSignupCampaignAward(
        [
          { id: 'web', name: 'Web $5', type: SIGNUP_BONUS_CAMPAIGN_TYPE, bonusPoints: 500 },
          { id: 'store', name: 'Enchanted Circle', type: SIGNUP_BONUS_CAMPAIGN_TYPE, bonusPoints: 2000 },
          { id: 'mult', type: 'MULTIPLIER', bonusPoints: 9999 },
        ],
        100,
      ),
    ).toEqual({ points: 2000, campaignId: 'store', campaignName: 'Enchanted Circle' });
  });

  it('falls back to the SIGNUP earn-rule amount when no welcome campaign matches', () => {
    expect(resolveSignupCampaignAward([{ id: 'm', type: 'MULTIPLIER', bonusPoints: 50 }], 100)).toEqual({
      points: 100,
    });
  });

  it('ignores zero-point welcome campaigns', () => {
    expect(
      resolveSignupCampaignAward(
        [{ id: 'z', type: SIGNUP_BONUS_CAMPAIGN_TYPE, bonusPoints: 0 }],
        100,
      ),
    ).toEqual({ points: 100 });
  });
});
