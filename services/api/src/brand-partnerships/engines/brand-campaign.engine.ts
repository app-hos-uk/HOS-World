import type { BrandCampaign } from '@prisma/client';

export function norm(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

export function productMatchesCampaign(
  product: { id: string; fandom?: string | null; brand?: string | null; categoryId?: string | null },
  campaign: Pick<
    BrandCampaign,
    'targetProductIds' | 'targetBrands' | 'targetFandoms' | 'targetCategoryIds'
  >,
): boolean {
  const hasTargets =
    (campaign.targetProductIds?.length ?? 0) > 0 ||
    (campaign.targetBrands?.length ?? 0) > 0 ||
    (campaign.targetFandoms?.length ?? 0) > 0 ||
    (campaign.targetCategoryIds?.length ?? 0) > 0;

  if (!hasTargets) return true;

  if (campaign.targetProductIds?.includes(product.id)) return true;

  const pb = norm(product.brand);
  if (pb && campaign.targetBrands?.some((b) => norm(b) === pb)) return true;

  const pf = norm(product.fandom);
  if (pf && campaign.targetFandoms?.some((f) => norm(f) === pf)) return true;

  const cat = product.categoryId;
  if (cat && campaign.targetCategoryIds?.includes(cat)) return true;

  return false;
}

/** Sum base points for lines that match the campaign's product rules. */
export function qualifyingBaseForCampaign(
  lines: Array<{
    productId: string;
    fandom?: string | null;
    brand?: string | null;
    categoryId?: string | null;
    lineBase: number;
  }>,
  campaign: Pick<
    BrandCampaign,
    'targetProductIds' | 'targetBrands' | 'targetFandoms' | 'targetCategoryIds'
  >,
): number {
  let q = 0;
  for (const line of lines) {
    if (
      productMatchesCampaign(
        {
          id: line.productId,
          fandom: line.fandom,
          brand: line.brand,
          categoryId: line.categoryId,
        },
        campaign,
      )
    ) {
      q += line.lineBase;
    }
  }
  return q;
}

export type BrandCampaignPickInput = Pick<
  BrandCampaign,
  'id' | 'multiplier' | 'bonusPoints' | 'type'
> & {
  targetProductIds: string[];
  targetBrands: string[];
  targetFandoms: string[];
  targetCategoryIds: string[];
};

/**
 * Best multiplier among qualifying MULTIPLIER campaigns; sum flat bonuses from
 * MULTIPLIER (if bonusPoints set) and BONUS_POINTS campaigns that qualify.
 */
export function pickBrandCampaignMultipliers(
  campaigns: BrandCampaignPickInput[],
  lines: Array<{
    productId: string;
    fandom?: string | null;
    brand?: string | null;
    categoryId?: string | null;
    lineBase: number;
  }>,
): {
  bestMult: number;
  multCampaignId?: string;
  bonusSum: number;
  qualifyingBase: number;
} {
  let bestMult = 1;
  let multCampaignId: string | undefined;
  let qualifyingBaseForWinner = 0;
  let bonusSum = 0;

  for (const c of campaigns) {
    const q = qualifyingBaseForCampaign(lines, c);
    if (q <= 0) continue;

    if (c.type === 'BONUS_POINTS' && c.bonusPoints) {
      bonusSum += c.bonusPoints;
    }

    if (c.type === 'MULTIPLIER') {
      const m = c.multiplier ? c.multiplier.toNumber() : 1;
      if (m > bestMult) {
        bestMult = m;
        multCampaignId = c.id;
        qualifyingBaseForWinner = q;
      }
      if (c.bonusPoints) bonusSum += c.bonusPoints;
    }
  }

  return {
    bestMult,
    multCampaignId,
    bonusSum,
    qualifyingBase: qualifyingBaseForWinner,
  };
}
