/**
 * Response shape DTOs — not used for validation, but exported for
 * Swagger documentation and frontend type-safety via shared-types.
 */

export class LoyaltyMembershipResponse {
  id: string;
  userId: string;
  cardNumber: string;
  currentBalance: number;
  totalPointsEarned: number;
  totalPointsRedeemed: number;
  totalSpend: number;
  purchaseCount: number;
  engagementCount: number;
  enrolledAt: Date;
  tier: {
    id: string;
    name: string;
    slug: string;
    level: number;
    multiplier: number;
  };
}

export class TierProgressResponse {
  currentTier: {
    id: string;
    name: string;
    slug: string;
    level: number;
  };
  nextTier: {
    id: string;
    name: string;
    slug: string;
    level: number;
    pointsThreshold: number;
  } | null;
  progressPercent: number;
  pointsToNext: number;
}

export class TransactionListResponse {
  items: {
    id: string;
    type: string;
    points: number;
    balanceBefore: number;
    balanceAfter: number;
    source: string;
    description: string | null;
    createdAt: Date;
  }[];
  total: number;
  page: number;
  limit: number;
}

export class RedemptionResponse {
  redemptionId: string;
  couponCode?: string;
}

export class CardPayloadResponse {
  cardNumber: string;
  tier: string;
  balance: number;
  qrPayload: string;
}

export class ReferralInfoResponse {
  code: string;
  conversions: number;
}
