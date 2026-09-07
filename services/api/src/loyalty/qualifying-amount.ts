import { Decimal } from '@prisma/client/runtime/library';
import { isSignupBonusCampaign } from './signup-bonus';

/** Matches "gift card", "gift cards", "gift-card", "gift_card", "giftcard". */
const GIFT_CARD_RE = /\bgift[\s_-]*cards?\b/i;

export type QualifyingLineInput = {
  quantity?: number | null;
  price?: Decimal | number | string | null;
  unitPrice?: Decimal | number | string | null;
  totalPrice?: Decimal | number | string | null;
  name?: string | null;
  product?: {
    name?: string | null;
    sku?: string | null;
    slug?: string | null;
    tags?: string[] | null;
    category?: string | null;
  } | null;
};

export type ThresholdCampaignInput = {
  id: string;
  type?: string | null;
  conditions?: unknown;
};

function toDec(value: Decimal | number | string | null | undefined): Decimal {
  if (value == null || value === '') return new Decimal(0);
  return value instanceof Decimal ? value : new Decimal(value);
}

function asRecord(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw as Record<string, unknown>;
}

export function isGiftCardLine(line: QualifyingLineInput): boolean {
  const parts = [
    line.name,
    line.product?.name,
    line.product?.sku,
    line.product?.slug,
    line.product?.category,
    ...(line.product?.tags ?? []),
  ];
  return parts.some((part) => typeof part === 'string' && GIFT_CARD_RE.test(part));
}

export function lineAmount(line: QualifyingLineInput): Decimal {
  if (line.totalPrice != null) return toDec(line.totalPrice);
  const qty = line.quantity ?? 1;
  const unit = line.unitPrice != null ? line.unitPrice : line.price;
  return toDec(unit).mul(qty);
}

/** Sum of line totals excluding gift-card items. */
export function computeQualifyingSubtotal(lines: QualifyingLineInput[]): Decimal {
  return (lines ?? []).reduce((sum, line) => {
    if (isGiftCardLine(line)) return sum;
    return sum.add(lineAmount(line));
  }, new Decimal(0));
}

export function isPercentageOfQualifyingCampaign(campaign: ThresholdCampaignInput): boolean {
  if (isSignupBonusCampaign(campaign)) return false;
  if (campaign.type === 'PERCENTAGE_OF_QUALIFYING') return true;
  const conditions = asRecord(campaign.conditions);
  return (
    conditions.pointsType === 'PERCENTAGE_OF_QUALIFYING' ||
    (conditions.earnRate != null && conditions.threshold != null)
  );
}

/**
 * Bonus points for spend over a campaign threshold.
 * bonus = (qualifyingSubtotal - threshold) * earnRate * pointsPerDollar
 * when qualifyingSubtotal > threshold.
 */
export function computeThresholdBonusPoints(
  qualifyingSubtotal: Decimal,
  campaigns: ThresholdCampaignInput[],
  defaults?: { pointsPerDollar?: number },
): { points: number; breakdown: Array<{ campaignId: string; points: number }> } {
  const breakdown: Array<{ campaignId: string; points: number }> = [];
  const defaultPpd = defaults?.pointsPerDollar && defaults.pointsPerDollar > 0 ? defaults.pointsPerDollar : 100;

  for (const campaign of campaigns) {
    if (!isPercentageOfQualifyingCampaign(campaign)) continue;
    const conditions = asRecord(campaign.conditions);
    const threshold = Number(conditions.threshold ?? 0);
    const earnRate = Number(conditions.earnRate ?? 0);
    const pointsPerDollar = Number(conditions.pointsPerDollar ?? defaultPpd);
    if (!Number.isFinite(threshold) || !Number.isFinite(earnRate) || earnRate <= 0) continue;
    if (!Number.isFinite(pointsPerDollar) || pointsPerDollar <= 0) continue;
    if (qualifyingSubtotal.lte(threshold)) continue;

    const pts = qualifyingSubtotal
      .sub(threshold)
      .mul(earnRate)
      .mul(pointsPerDollar)
      .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
      .toNumber();
    if (pts > 0) breakdown.push({ campaignId: campaign.id, points: pts });
  }

  return {
    points: breakdown.reduce((sum, row) => sum + row.points, 0),
    breakdown,
  };
}

export function isWelcomeRewardOption(
  option: { id?: string | null; name?: string | null; type?: string | null } | null | undefined,
  campaignConditions: Record<string, unknown>[] = [],
): boolean {
  if (!option) return false;
  const name = (option.name ?? '').toLowerCase();
  const type = (option.type ?? '').toUpperCase();
  if (name.includes('welcome') || name.includes('signup bonus')) return true;
  if (type === 'WELCOME' || type === 'SIGNUP') return true;

  for (const conditions of campaignConditions) {
    if (conditions.welcomeRewardOptionId && conditions.welcomeRewardOptionId === option.id) {
      return true;
    }
    const ids = conditions.welcomeRewardOptionIds;
    if (Array.isArray(ids) && option.id && ids.includes(option.id)) return true;
    const gated = conditions.gatedSources;
    if (Array.isArray(gated) && gated.includes('SIGNUP') && name.includes('reward')) return true;
  }
  return false;
}

/**
 * POS till burns often have no catalogue option. Treat a first redemption of the
 * exact SIGNUP bonus amount as the Welcome Reward so the purchase-minimum gate still applies.
 */
export function isSignupSizedWelcomeBurn(
  points: number,
  signupPoints: number | null | undefined,
  priorWelcomeRedemptions: number,
): boolean {
  if (!signupPoints || signupPoints <= 0) return false;
  if (points !== signupPoints) return false;
  return priorWelcomeRedemptions <= 0;
}

export function welcomeMinPurchaseFromConditions(
  campaignConditions: Record<string, unknown>[],
  fallback: number,
): number {
  let threshold = fallback;
  for (const conditions of campaignConditions) {
    const raw = conditions.minPurchaseToRedeem ?? conditions.threshold;
    const value = Number(raw);
    if (Number.isFinite(value) && value > 0) threshold = value;
  }
  return threshold;
}
