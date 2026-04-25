export type AmbassadorTierSlug = 'ADVOCATE' | 'CHAMPION' | 'LEGEND';

export interface AmbassadorTierDef {
  slug: AmbassadorTierSlug;
  name: string;
  level: number;
  requirements: {
    minReferralSignups: number;
    minApprovedUgc: number;
    minAmbassadorPoints: number;
  };
  commissionPointsRate: number;
}

export const AMBASSADOR_TIERS: AmbassadorTierDef[] = [
  {
    slug: 'ADVOCATE',
    name: 'Advocate',
    level: 1,
    requirements: { minReferralSignups: 0, minApprovedUgc: 0, minAmbassadorPoints: 0 },
    commissionPointsRate: 1.5,
  },
  {
    slug: 'CHAMPION',
    name: 'Champion',
    level: 2,
    requirements: { minReferralSignups: 5, minApprovedUgc: 3, minAmbassadorPoints: 0 },
    commissionPointsRate: 2.0,
  },
  {
    slug: 'LEGEND',
    name: 'Legend',
    level: 3,
    requirements: { minReferralSignups: 15, minApprovedUgc: 10, minAmbassadorPoints: 1000 },
    commissionPointsRate: 2.5,
  },
];

export function evaluateAmbassadorTier(profile: {
  totalReferralSignups: number;
  totalUgcApproved: number;
  totalPointsEarnedAsAmb: number;
}): AmbassadorTierDef {
  let chosen = AMBASSADOR_TIERS[0];
  for (const t of AMBASSADOR_TIERS) {
    const { minReferralSignups, minApprovedUgc, minAmbassadorPoints } = t.requirements;
    if (
      profile.totalReferralSignups >= minReferralSignups &&
      profile.totalUgcApproved >= minApprovedUgc &&
      profile.totalPointsEarnedAsAmb >= minAmbassadorPoints
    ) {
      chosen = t;
    }
  }
  return chosen;
}

export function ambassadorTierIndex(slug: string): number {
  const i = AMBASSADOR_TIERS.findIndex((t) => t.slug === slug);
  return i < 0 ? 0 : i;
}
