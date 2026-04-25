import type {
  POSOutlet,
  POSProductPayload,
  POSCustomerPayload,
  POSCustomer,
  POSSale,
} from './pos-types';

export interface POSAdapter {
  readonly providerName: string;

  authenticate(credentials: Record<string, unknown>): Promise<void>;
  refreshAuth(): Promise<void>;

  getOutlets(): Promise<POSOutlet[]>;

  syncProduct(product: POSProductPayload, outletId: string): Promise<string>;
  removeProduct(externalId: string, outletId: string): Promise<void>;

  getInventory(externalProductId: string, outletId: string): Promise<number>;
  updateInventory(externalProductId: string, outletId: string, quantity: number): Promise<void>;

  syncCustomer(customer: POSCustomerPayload): Promise<string>;
  lookupCustomer(identifier: string): Promise<POSCustomer | null>;

  getSales(since: Date, outletId?: string): Promise<POSSale[]>;

  validateWebhook(payload: unknown, signature: string, secret: string): boolean;
  parseWebhookSale(payload: unknown): POSSale;
}
