/** Seasonal / source-specific welcome points. Never applied to purchase earn. */
export const SIGNUP_BONUS_CAMPAIGN_TYPE = 'SIGNUP_BONUS';

/** Admin UI uses POS; POS purchase earn uses HOS_OUTLET_POS. Treat them as one source. */
export function enrollmentChannelAliases(channel: string): string[] {
  const normalized = channel.trim().toUpperCase();
  if (!normalized) return ['WEB'];
  if (normalized === 'POS' || normalized === 'HOS_OUTLET_POS') {
    return ['POS', 'HOS_OUTLET_POS'];
  }
  if (normalized === 'AUTO_PURCHASE') return ['WEB', 'AUTO_PURCHASE'];
  return [normalized];
}

export type SignupCampaignLike = {
  id: string;
  name?: string | null;
  type?: string | null;
  bonusPoints?: number | null;
};

export function isSignupBonusCampaign(campaign: { type?: string | null }): boolean {
  return campaign.type === SIGNUP_BONUS_CAMPAIGN_TYPE;
}

/** Campaign types whose points are computed separately (not via multiplier/flat-bonus). */
function isNonMultiplierCampaign(campaign: { type?: string | null }): boolean {
  return campaign.type === SIGNUP_BONUS_CAMPAIGN_TYPE || campaign.type === 'PERCENTAGE_OF_QUALIFYING';
}

/**
 * Purchase earn must ignore welcome-offer campaigns AND threshold campaigns
 * (threshold bonus is computed separately by computeThresholdBonusPoints).
 */
export function purchaseEarnCampaigns<T extends { type?: string | null }>(campaigns: T[]): T[] {
  return campaigns.filter((c) => !isNonMultiplierCampaign(c));
}

function asPositiveInt(value: unknown): number {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Matching SIGNUP_BONUS campaign with the highest bonusPoints replaces the default
 * SIGNUP earn-rule amount. If none match, the fallback (earn rule / env) is used.
 */
export function resolveSignupCampaignAward(
  campaigns: SignupCampaignLike[],
  fallbackPoints: number,
): { points: number; campaignId?: string; campaignName?: string } {
  let best: SignupCampaignLike | undefined;
  let bestPts = 0;
  for (const campaign of campaigns) {
    if (!isSignupBonusCampaign(campaign)) continue;
    const pts = asPositiveInt(campaign.bonusPoints);
    if (pts > bestPts) {
      bestPts = pts;
      best = campaign;
    }
  }
  if (best && bestPts > 0) {
    return { points: bestPts, campaignId: best.id, campaignName: best.name ?? undefined };
  }
  const fallback = asPositiveInt(fallbackPoints);
  return { points: fallback };
}
