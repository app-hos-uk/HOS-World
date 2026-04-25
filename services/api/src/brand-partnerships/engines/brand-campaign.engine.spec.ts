import { Decimal } from '@prisma/client/runtime/library';
import {
  norm,
  pickBrandCampaignMultipliers,
  productMatchesCampaign,
  qualifyingBaseForCampaign,
} from './brand-campaign.engine';

describe('brand-campaign.engine', () => {
  const emptyTargets = {
    targetProductIds: [] as string[],
    targetBrands: [] as string[],
    targetFandoms: [] as string[],
    targetCategoryIds: [] as string[],
  };

  it('norm lowercases and trims', () => {
    expect(norm('  Noble Collection  ')).toBe('noble collection');
  });

  it('productMatchesCampaign: all empty targets matches any', () => {
    expect(
      productMatchesCampaign(
        { id: 'p1', fandom: 'X', brand: 'Y', categoryId: 'c1' },
        emptyTargets,
      ),
    ).toBe(true);
  });

  it('productMatchesCampaign: product id', () => {
    expect(
      productMatchesCampaign(
        { id: 'p1', fandom: null, brand: null, categoryId: null },
        { ...emptyTargets, targetProductIds: ['p1'] },
      ),
    ).toBe(true);
  });

  it('productMatchesCampaign: brand case-insensitive', () => {
    expect(
      productMatchesCampaign(
        { id: 'p1', brand: 'noble collection' },
        { ...emptyTargets, targetBrands: ['Noble Collection'] },
      ),
    ).toBe(true);
  });

  it('productMatchesCampaign: fandom case-insensitive', () => {
    expect(
      productMatchesCampaign(
        { id: 'p1', fandom: 'harry potter' },
        { ...emptyTargets, targetFandoms: ['Harry Potter'] },
      ),
    ).toBe(true);
  });

  it('productMatchesCampaign: category', () => {
    expect(
      productMatchesCampaign(
        { id: 'p1', categoryId: 'cat-1' },
        { ...emptyTargets, targetCategoryIds: ['cat-1'] },
      ),
    ).toBe(true);
  });

  it('productMatchesCampaign: no match', () => {
    expect(
      productMatchesCampaign(
        { id: 'p1', fandom: 'LOTR', brand: 'X' },
        { ...emptyTargets, targetFandoms: ['Harry Potter'] },
      ),
    ).toBe(false);
  });

  it('qualifyingBaseForCampaign sums matching lines only', () => {
    const lines = [
      { productId: 'a', fandom: 'Harry Potter', lineBase: 10 },
      { productId: 'b', fandom: 'LOTR', lineBase: 5 },
    ];
    const q = qualifyingBaseForCampaign(lines, {
      ...emptyTargets,
      targetFandoms: ['Harry Potter'],
    });
    expect(q).toBe(10);
  });

  it('pickBrandCampaignMultipliers: mult + bonus', () => {
    const campaigns = [
      {
        id: 'c1',
        type: 'MULTIPLIER',
        multiplier: new Decimal(2),
        bonusPoints: null,
        ...emptyTargets,
        targetFandoms: ['Harry Potter'],
      },
      {
        id: 'c2',
        type: 'BONUS_POINTS',
        multiplier: null,
        bonusPoints: 25,
        ...emptyTargets,
        targetFandoms: ['Harry Potter'],
      },
    ];
    const lines = [{ productId: 'p1', fandom: 'harry potter', lineBase: 100 }];
    const r = pickBrandCampaignMultipliers(campaigns as any, lines);
    expect(r.bestMult).toBe(2);
    expect(r.multCampaignId).toBe('c1');
    expect(r.bonusSum).toBe(25);
    expect(r.qualifyingBase).toBe(100);
  });
});
