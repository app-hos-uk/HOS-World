export interface AchievementDef {
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  points: number;
}

export const AMBASSADOR_ACHIEVEMENTS: AchievementDef[] = [
  {
    slug: 'ambassador-unlocked',
    name: 'Ambassador Unlocked',
    description: 'Joined the ambassador programme',
    icon: 'star',
    points: 200,
  },
  {
    slug: 'first-referral',
    name: 'First Referral',
    description: 'Your first loyalty referral converted',
    icon: 'user-plus',
    points: 100,
  },
  {
    slug: 'referral-5',
    name: 'Referral Pro',
    description: '5 referral signups',
    icon: 'users',
    points: 250,
  },
  {
    slug: 'referral-15',
    name: 'Referral Legend',
    description: '15 referral signups',
    icon: 'crown',
    points: 500,
  },
  {
    slug: 'referral-50',
    name: 'Referral Master',
    description: '50 referral signups',
    icon: 'trophy',
    points: 1000,
  },
  {
    slug: 'ugc-first',
    name: 'Content Creator',
    description: 'First UGC approved',
    icon: 'camera',
    points: 100,
  },
  {
    slug: 'ugc-star',
    name: 'UGC Star',
    description: '10 UGC approved',
    icon: 'sparkles',
    points: 300,
  },
  {
    slug: 'ugc-featured',
    name: 'Featured Creator',
    description: 'First UGC featured',
    icon: 'fire',
    points: 200,
  },
  {
    slug: 'champion-tier',
    name: 'Champion Achiever',
    description: 'Reached Champion tier',
    icon: 'shield',
    points: 500,
  },
  {
    slug: 'legend-tier',
    name: 'Legendary Ambassador',
    description: 'Reached Legend tier',
    icon: 'gem',
    points: 1000,
  },
  {
    slug: 'points-1000',
    name: 'Points Millionaire',
    description: 'Earned 1000+ ambassador points',
    icon: 'coins',
    points: 200,
  },
  {
    slug: 'social-butterfly',
    name: 'Social Butterfly',
    description: 'UGC from 3+ platforms',
    icon: 'share',
    points: 150,
  },
];

export function achievementBySlug(slug: string): AchievementDef | undefined {
  return AMBASSADOR_ACHIEVEMENTS.find((a) => a.slug === slug);
}
