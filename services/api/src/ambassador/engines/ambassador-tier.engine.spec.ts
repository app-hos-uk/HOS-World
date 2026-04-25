import {
  AMBASSADOR_TIERS,
  ambassadorTierIndex,
  evaluateAmbassadorTier,
} from './ambassador-tier.engine';

describe('ambassador-tier.engine', () => {
  it('returns ADVOCATE for zero stats', () => {
    const t = evaluateAmbassadorTier({
      totalReferralSignups: 0,
      totalUgcApproved: 0,
      totalPointsEarnedAsAmb: 0,
    });
    expect(t.slug).toBe('ADVOCATE');
    expect(t.commissionPointsRate).toBe(1.5);
  });

  it('returns CHAMPION when referrals and UGC thresholds met', () => {
    const t = evaluateAmbassadorTier({
      totalReferralSignups: 5,
      totalUgcApproved: 3,
      totalPointsEarnedAsAmb: 0,
    });
    expect(t.slug).toBe('CHAMPION');
    expect(t.commissionPointsRate).toBe(2.0);
  });

  it('returns LEGEND when all thresholds met', () => {
    const t = evaluateAmbassadorTier({
      totalReferralSignups: 15,
      totalUgcApproved: 10,
      totalPointsEarnedAsAmb: 1000,
    });
    expect(t.slug).toBe('LEGEND');
    expect(t.commissionPointsRate).toBe(2.5);
  });

  it('does not return CHAMPION with only referrals', () => {
    const t = evaluateAmbassadorTier({
      totalReferralSignups: 10,
      totalUgcApproved: 0,
      totalPointsEarnedAsAmb: 0,
    });
    expect(t.slug).toBe('ADVOCATE');
  });

  it('ambassadorTierIndex maps slugs', () => {
    expect(ambassadorTierIndex('ADVOCATE')).toBe(0);
    expect(ambassadorTierIndex('CHAMPION')).toBe(1);
    expect(ambassadorTierIndex('LEGEND')).toBe(2);
    expect(ambassadorTierIndex('UNKNOWN')).toBe(0);
  });

  it('exposes three tier definitions', () => {
    expect(AMBASSADOR_TIERS).toHaveLength(3);
  });
});
