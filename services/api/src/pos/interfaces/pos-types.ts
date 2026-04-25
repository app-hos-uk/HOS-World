export interface POSOutlet {
  externalId: string;
  name: string;
  address?: string;
  city?: string;
  country?: string;
  timezone?: string;
  isActive: boolean;
}

export interface POSVariantPayload {
  sku: string;
  name: string;
  retailPrice: number;
  costPrice?: number;
}

export interface POSProductPayload {
  internalId: string;
  /** When set, adapter updates this POS record instead of creating. */
  existingExternalId?: string;
  sku: string;
  name: string;
  description?: string;
  retailPrice: number;
  costPrice?: number;
  taxRate?: number;
  imageUrl?: string;
  categoryName?: string;
  tags?: string[];
  variants?: POSVariantPayload[];
}

export interface POSCustomerPayload {
  internalId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  loyaltyCardNumber?: string;
}

export interface POSCustomer {
  externalId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export interface POSSaleItem {
  externalProductId: string;
  sku?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  taxAmount: number;
}

export interface POSSale {
  externalId: string;
  invoiceNumber?: string;
  saleDate: Date;
  outletId: string;
  customer?: { email?: string; phone?: string; externalId?: string };
  items: POSSaleItem[];
  totalAmount: number;
  taxAmount: number;
  discountAmount: number;
  currency: string;
  rawPayload?: unknown;
}

export type LightspeedCredentials = {
  domainPrefix: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  clientId?: string;
  clientSecret?: string;
};
