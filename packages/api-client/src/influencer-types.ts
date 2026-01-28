/**
 * Types for influencer-related API endpoints.
 * Used by ApiClient methods to replace `any` with proper types.
 */

// Influencer profile (me)
export interface InfluencerProfile {
  id: string;
  displayName: string;
  slug: string;
  bio?: string;
  profileImage?: string;
  bannerImage?: string;
  referralCode: string;
  tier: string;
  status: string;
  socialLinks?: Record<string, string>;
}

// Analytics (me/analytics)
export interface InfluencerAnalytics {
  totalClicks: number;
  totalConversions: number;
  conversionRate: string | number;
  totalSalesAmount: number;
  totalCommission: number;
  pendingCommission: number;
  approvedCommission: number;
  paidCommission: number;
  tier: string;
  referralCode: string;
  clicksByDay: Array<{ date: string; count: number }>;
  conversionsByDay: Array<{ date: string; count: number }>;
}

// Product link (me/product-links)
export interface InfluencerProductLink {
  id: string;
  productId: string;
  product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    images: Array<{ url: string; alt?: string }>;
  };
  clicks: number;
  conversions: number;
  referralUrl: string;
  createdAt: string;
}

// Storefront settings (me/storefront)
export interface InfluencerStorefront {
  primaryColor?: string;
  secondaryColor?: string;
  backgroundColor?: string;
  textColor?: string;
  fontFamily?: string;
  layoutType?: string;
  showBanner?: boolean;
  showBio?: boolean;
  showSocialLinks?: boolean;
  metaTitle?: string;
  metaDescription?: string;
  featuredProductIds?: string[];
}

export interface UpdateStorefrontDto {
  primaryColor?: string;
  secondaryColor?: string;
  backgroundColor?: string;
  textColor?: string;
  fontFamily?: string;
  layoutType?: string;
  showBanner?: boolean;
  showBio?: boolean;
  showSocialLinks?: boolean;
  metaTitle?: string;
  metaDescription?: string;
}

// Public storefront (GET /i/:slug)
export interface PublicInfluencerInfo {
  displayName: string;
  slug: string;
  bio?: string;
  profileImage?: string;
  bannerImage?: string;
  socialLinks?: Record<string, string>;
  referralCode: string;
}

export interface PublicStorefrontProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  images?: Array<{ url: string; alt?: string }>;
}

export interface GetInfluencerStorefrontResponse {
  influencer: PublicInfluencerInfo;
  storefront: InfluencerStorefront | null;
  featuredProducts: PublicStorefrontProduct[];
}

// Invitation (public)
export interface InfluencerInvitation {
  id: string;
  email: string;
  token: string;
  expiresAt: string;
  status: string;
  message?: string;
  baseCommissionRate?: number;
  invitedBy?: string;
}

export interface AcceptInfluencerInvitationDto {
  password: string;
  firstName: string;
  lastName: string;
  displayName: string;
}

// Referrals
export interface TrackReferralDto {
  referralCode: string;
  visitorId?: string;
  landingPage?: string;
  productId?: string;
  utmParams?: Record<string, string>;
}

// Commissions & earnings
export interface InfluencerCommission {
  id: string;
  orderId: string;
  orderTotal: number;
  rateSource: string;
  rateApplied: number;
  amount: number;
  status: string;
  currency: string;
  createdAt: string;
}

export interface InfluencerEarningsSummary {
  pending: number;
  approved: number;
  paid: number;
  cancelled: number;
  total: number;
  available: number;
}

// Pagination (when response includes both data and pagination)
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedDataResponse<T> {
  data: T;
  pagination?: PaginationMeta;
  message?: string;
}
