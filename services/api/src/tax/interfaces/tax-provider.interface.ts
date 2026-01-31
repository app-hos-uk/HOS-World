/**
 * Tax Provider Interface
 * All tax service integrations must implement this interface
 */

export interface TaxAddress {
  street1: string;
  street2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string; // ISO 3166-1 alpha-2
}

export interface TaxLineItem {
  id: string;
  productId?: string;
  sku?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number; // quantity * unitPrice
  taxCode?: string; // Product tax code (e.g., "P0000000" for general merchandise)
  discountAmount?: number;
  isTaxIncluded?: boolean;
}

export interface TaxCalculationRequest {
  transactionId: string;
  transactionType: 'SALE' | 'RETURN' | 'ESTIMATE';
  transactionDate: Date;
  customerCode?: string; // Customer identifier for exemption lookup
  currencyCode: string; // ISO 4217
  fromAddress: TaxAddress; // Ship from / origin
  toAddress: TaxAddress; // Ship to / destination
  lineItems: TaxLineItem[];
  discount?: {
    type: 'FIXED' | 'PERCENTAGE';
    amount: number;
  };
  shippingAmount?: number;
  shippingTaxCode?: string;
  exemptionNumber?: string; // Tax exemption certificate number
  isCommit?: boolean; // Whether to commit the transaction immediately
}

export interface TaxLineItemResult {
  lineItemId: string;
  taxableAmount: number;
  taxAmount: number;
  taxRate: number; // As decimal (e.g., 0.20 for 20%)
  exemptAmount?: number;
  details: TaxJurisdictionDetail[];
}

export interface TaxJurisdictionDetail {
  jurisdictionType: 'COUNTRY' | 'STATE' | 'COUNTY' | 'CITY' | 'DISTRICT';
  jurisdictionName: string;
  jurisdictionCode?: string;
  taxType: string; // VAT, SALES_TAX, GST, etc.
  taxableAmount: number;
  taxAmount: number;
  taxRate: number;
}

export interface TaxCalculationResponse {
  transactionId: string;
  documentCode?: string; // Provider's document ID
  status: 'TEMPORARY' | 'SAVED' | 'COMMITTED' | 'CANCELLED';
  transactionDate: Date;
  totalAmount: number; // Total including tax
  totalTaxableAmount: number;
  totalTaxAmount: number;
  totalExemptAmount: number;
  currencyCode: string;
  lineItems: TaxLineItemResult[];
  summary: TaxSummary[];
  metadata?: Record<string, any>;
}

export interface TaxSummary {
  taxType: string;
  jurisdictionName: string;
  taxableAmount: number;
  taxAmount: number;
  taxRate: number;
}

export interface AddressValidationResult {
  isValid: boolean;
  normalizedAddress?: TaxAddress;
  taxJurisdictions?: Array<{
    code: string;
    name: string;
    type: string;
  }>;
  messages?: string[];
}

export interface ExemptionCertificate {
  id: string;
  customerId: string;
  customerName?: string;
  certificateNumber: string;
  exemptionReason: string;
  region: string; // State/Province code
  country: string;
  validFrom: Date;
  validTo?: Date;
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
  documentUrl?: string;
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
  details?: Record<string, any>;
  duration?: number;
}

/**
 * Main Tax Provider Interface
 * All tax service implementations must provide these methods
 */
export interface ITaxProvider {
  /** Provider identifier (e.g., 'avalara', 'taxjar') */
  readonly providerId: string;

  /** Human-readable provider name */
  readonly providerName: string;

  /** Whether this provider is currently configured and ready to use */
  isConfigured(): boolean;

  /**
   * Test the connection to the tax service API
   */
  testConnection(): Promise<TestConnectionResult>;

  /**
   * Calculate tax for a transaction
   */
  calculateTax(request: TaxCalculationRequest): Promise<TaxCalculationResponse>;

  /**
   * Commit a transaction (finalize for tax reporting)
   * Some providers require this after successful order completion
   */
  commitTransaction(transactionId: string): Promise<{ success: boolean; message: string }>;

  /**
   * Void a transaction (cancel from tax records)
   * Called when an order is cancelled before fulfillment
   */
  voidTransaction(transactionId: string): Promise<{ success: boolean; message: string }>;

  /**
   * Refund a transaction (record a return)
   * Called when an order is returned
   */
  refundTransaction(
    originalTransactionId: string,
    refundTransactionId: string,
    items: TaxLineItem[],
  ): Promise<TaxCalculationResponse>;

  /**
   * Validate an address for tax purposes
   */
  validateAddress(address: TaxAddress): Promise<AddressValidationResult>;

  /**
   * Get exemption certificates for a customer
   */
  getExemptionCertificates?(customerId: string): Promise<ExemptionCertificate[]>;

  /**
   * Create an exemption certificate
   */
  createExemptionCertificate?(
    certificate: Omit<ExemptionCertificate, 'id' | 'status'>,
  ): Promise<ExemptionCertificate>;

  /**
   * Get tax codes/categories for product classification
   */
  getTaxCodes?(): Promise<Array<{ code: string; description: string }>>;

  /**
   * Get nexus (tax obligation) locations
   */
  getNexusLocations?(): Promise<Array<{ country: string; region: string; hasNexus: boolean }>>;
}

/**
 * Base class for tax providers with common functionality
 */
export abstract class BaseTaxProvider implements ITaxProvider {
  abstract readonly providerId: string;
  abstract readonly providerName: string;

  protected credentials: Record<string, any> = {};
  protected isTestMode: boolean = true;

  constructor(credentials: Record<string, any>, isTestMode: boolean = true) {
    this.credentials = credentials;
    this.isTestMode = isTestMode;
  }

  abstract isConfigured(): boolean;
  abstract testConnection(): Promise<TestConnectionResult>;
  abstract calculateTax(request: TaxCalculationRequest): Promise<TaxCalculationResponse>;
  abstract commitTransaction(transactionId: string): Promise<{ success: boolean; message: string }>;
  abstract voidTransaction(transactionId: string): Promise<{ success: boolean; message: string }>;
  abstract refundTransaction(
    originalTransactionId: string,
    refundTransactionId: string,
    items: TaxLineItem[],
  ): Promise<TaxCalculationResponse>;
  abstract validateAddress(address: TaxAddress): Promise<AddressValidationResult>;

  /**
   * Get the appropriate API base URL based on test mode
   */
  protected abstract getBaseUrl(): string;

  /**
   * Format a date for API calls
   */
  protected formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Round tax amount to 2 decimal places
   */
  protected roundTax(amount: number): number {
    return Math.round(amount * 100) / 100;
  }
}
