import { PromotionType, PromotionStatus } from '@prisma/client';

/**
 * Promotion condition structure
 */
export interface PromotionConditions {
  requirementType?: 'MIN_ORDER_AMOUNT' | 'MIN_QUANTITY' | 'NONE';
  eligibilityType?: 'ALL' | 'SPECIFIC_PRODUCTS' | 'SPECIFIC_CATEGORIES';
  cartValue?: {
    min?: number;
    max?: number;
  };
  productIds?: string[];
  categoryIds?: string[];
  collectionIds?: string[];
  customerGroupId?: string;
  minQuantity?: number;
}

/**
 * Promotion action structure
 */
export interface PromotionActions {
  percentage?: number; // For percentage discounts (e.g., 10.5)
  fixedAmount?: number; // For fixed discounts (e.g., 10.50)
  buyQuantity?: number; // For Buy X Get Y
  getQuantity?: number; // For Buy X Get Y
  freeShipping?: boolean; // For free shipping
}

/**
 * Promotion with typed actions and conditions
 */
export interface PromotionWithDetails {
  id: string;
  name: string;
  description?: string | null;
  type: PromotionType;
  status: PromotionStatus;
  priority: number;
  startDate: Date;
  endDate?: Date | null;
  conditions: PromotionConditions;
  actions: PromotionActions;
  isStackable: boolean;
  usageLimit?: number | null;
  usageCount: number;
  userUsageLimit?: number | null;
  sellerId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Cart item structure for promotion evaluation
 */
export interface CartItemForPromotion {
  productId: string;
  price: number;
  quantity: number;
}

/**
 * Applied promotion result
 */
export interface AppliedPromotion {
  type: 'coupon' | 'promotion';
  id?: string;
  code?: string;
  name?: string;
  discount: number;
}

/**
 * Promotion application result
 */
export interface PromotionApplicationResult {
  discount: number;
  appliedPromotions: AppliedPromotion[];
}
