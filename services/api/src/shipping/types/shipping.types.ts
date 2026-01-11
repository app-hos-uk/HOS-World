import { ShippingMethodType } from '@prisma/client';

/**
 * Shipping rule conditions structure
 */
export interface ShippingRuleConditions {
  weightRange?: {
    min?: number; // in kg
    max?: number; // in kg
  };
  cartValueRange?: {
    min?: number;
    max?: number;
  };
  country?: string;
  state?: string;
  city?: string;
  postalCode?: string;
}

/**
 * Shipping rule with typed conditions
 */
export interface ShippingRuleWithDetails {
  id: string;
  shippingMethodId: string;
  name: string;
  priority: number;
  conditions: ShippingRuleConditions;
  rate: number;
  freeShippingThreshold?: number | null;
  estimatedDays?: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Shipping method with rules
 */
export interface ShippingMethodWithRules {
  id: string;
  name: string;
  description?: string | null;
  type: ShippingMethodType;
  isActive: boolean;
  sellerId?: string | null;
  rules: ShippingRuleWithDetails[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Destination for shipping calculation
 */
export interface ShippingDestination {
  country: string;
  state?: string;
  city?: string;
  postalCode?: string;
}

/**
 * Shipping option result
 */
export interface ShippingOption {
  method: {
    id: string;
    name: string;
    description?: string | null;
    type: ShippingMethodType;
  };
  rule: {
    id: string;
    name: string;
    estimatedDays?: number | null;
  };
  rate: number;
  freeShipping: boolean;
}

/**
 * Cart item for shipping calculation
 */
export interface CartItemForShipping {
  productId: string;
  quantity: number;
  weight?: number; // in kg
}
