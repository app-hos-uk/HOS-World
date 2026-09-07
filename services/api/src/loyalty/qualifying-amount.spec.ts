import { Decimal } from '@prisma/client/runtime/library';
import {
  computeQualifyingSubtotal,
  computeThresholdBonusPoints,
  isGiftCardLine,
  isSignupSizedWelcomeBurn,
  isWelcomeRewardOption,
} from './qualifying-amount';

describe('qualifying-amount', () => {
  describe('isGiftCardLine', () => {
    it('detects gift cards by product name', () => {
      expect(isGiftCardLine({ product: { name: 'HOS Gift Card $50' }, price: 50, quantity: 1 })).toBe(
        true,
      );
    });

    it('detects gift cards by POS line name', () => {
      expect(isGiftCardLine({ name: 'Gift Card', unitPrice: 25, quantity: 1 })).toBe(true);
    });

    it('does not treat regular merch as a gift card', () => {
      expect(isGiftCardLine({ product: { name: 'Wand of Secrets' }, price: 40, quantity: 1 })).toBe(
        false,
      );
    });
  });

  describe('computeQualifyingSubtotal', () => {
    it('sums merch and excludes gift-card lines', () => {
      const total = computeQualifyingSubtotal([
        { product: { name: 'Robe' }, price: 60, quantity: 1 },
        { product: { name: '$25 Gift Card' }, price: 25, quantity: 2 },
        { name: 'Pin', unitPrice: 10, quantity: 3 },
      ]);
      expect(total.toNumber()).toBe(90);
    });
  });

  describe('computeThresholdBonusPoints', () => {
    it('awards 20% of spend above $85 at 100 points per dollar', () => {
      const { points, breakdown } = computeThresholdBonusPoints(new Decimal(185), [
        {
          id: 'camp-1',
          type: 'PERCENTAGE_OF_QUALIFYING',
          conditions: { threshold: 85, earnRate: 0.2, pointsPerDollar: 100 },
        },
      ]);
      expect(points).toBe(2000);
      expect(breakdown).toEqual([{ campaignId: 'camp-1', points: 2000 }]);
    });

    it('awards nothing at or below the threshold', () => {
      const { points } = computeThresholdBonusPoints(new Decimal(85), [
        {
          id: 'camp-1',
          type: 'PERCENTAGE_OF_QUALIFYING',
          conditions: { threshold: 85, earnRate: 0.2, pointsPerDollar: 100 },
        },
      ]);
      expect(points).toBe(0);
    });
  });

  describe('isWelcomeRewardOption', () => {
    it('matches welcome-named options', () => {
      expect(isWelcomeRewardOption({ id: 'o1', name: '$20 Welcome Reward', type: 'DISCOUNT' })).toBe(
        true,
      );
    });

    it('matches campaign-configured option ids', () => {
      expect(
        isWelcomeRewardOption({ id: 'opt-welcome', name: '$20 Discount', type: 'DISCOUNT' }, [
          { welcomeRewardOptionId: 'opt-welcome' },
        ]),
      ).toBe(true);
    });

    it('ignores unrelated options', () => {
      expect(isWelcomeRewardOption({ id: 'o2', name: '$5 Discount', type: 'DISCOUNT' })).toBe(false);
    });
  });

  describe('isSignupSizedWelcomeBurn', () => {
    it('gates the first redemption of the exact signup bonus', () => {
      expect(isSignupSizedWelcomeBurn(2000, 2000, 0)).toBe(true);
    });

    it('does not gate later redemptions of the same amount', () => {
      expect(isSignupSizedWelcomeBurn(2000, 2000, 1)).toBe(false);
    });

    it('does not gate a different point amount', () => {
      expect(isSignupSizedWelcomeBurn(500, 2000, 0)).toBe(false);
    });
  });
});
