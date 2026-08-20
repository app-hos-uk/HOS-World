import type {
  POSOutlet,
  POSProductPayload,
  POSCustomerPayload,
  POSCustomer,
  POSSale,
  POSSalesPage,
  POSGiftCard,
  POSGiftCardCreatePayload,
  POSGiftCardTransaction,
  POSGiftCardTransactionPayload,
} from './pos-types';

export interface POSAdapter {
  readonly providerName: string;

  authenticate(credentials: Record<string, unknown>): Promise<void>;
  refreshAuth(): Promise<void>;

  /**
   * Bound the total wall-clock time this adapter may spend on provider calls,
   * as an absolute epoch-ms deadline (`undefined` clears it). Interactive callers set
   * this so a slow provider surfaces an error while the caller is still listening,
   * rather than completing after the HTTP client has given up. Optional: providers
   * without budget support ignore it.
   */
  setRequestDeadline?(deadlineAt: number | undefined): void;

  getOutlets(): Promise<POSOutlet[]>;

  syncProduct(product: POSProductPayload, outletId: string): Promise<string>;
  removeProduct(externalId: string, outletId: string): Promise<void>;

  getInventory(externalProductId: string, outletId: string): Promise<number>;
  updateInventory(externalProductId: string, outletId: string, quantity: number): Promise<void>;

  syncCustomer(customer: POSCustomerPayload): Promise<string>;
  lookupCustomer(identifier: string): Promise<POSCustomer | null>;

  /**
   * Page sales via Lightspeed version cursor (`after` / `version.max`).
   * Outlet filtering is client-side when outletId is set (API has no outlet_id filter).
   */
  getSales(params: { afterVersion?: number; outletId?: string }): Promise<POSSalesPage>;

  /** Single-sale lookup by invoice/receipt number (ship-from-store claim flow). */
  getSaleByInvoice?(params: {
    invoiceNumber: string;
    outletId?: string;
  }): Promise<POSSale | null>;

  validateWebhook(payload: unknown, signature: string, secret: string): boolean;
  parseWebhookSale(payload: unknown): POSSale;

  /** Issue a new gift card (Lightspeed POST /gift_cards). */
  createGiftCard(payload: POSGiftCardCreatePayload): Promise<POSGiftCard>;

  /** List gift cards (Lightspeed GET /gift_cards, paginated). */
  listGiftCards(params?: { pageSize?: number }): Promise<POSGiftCard[]>;

  /** Lookup by card number (Lightspeed GET /gift_cards/by_number/{number}). */
  getGiftCardByNumber(number: string): Promise<POSGiftCard | null>;

  /**
   * Create a gift card transaction. `clientId` is the Lightspeed idempotency key.
   * REDEEMING amounts are sent negative; RELOADING positive.
   */
  giftCardTransaction(
    number: string,
    payload: POSGiftCardTransactionPayload,
  ): Promise<POSGiftCardTransaction>;

  /** Reverse a REDEEMING transaction (Lightspeed DELETE /gift_cards/transactions/{id}). */
  reverseGiftCardTransaction(transactionId: string): Promise<POSGiftCardTransaction>;

  /** Void a gift card (Lightspeed DELETE /gift_cards/by_number/{number}). */
  voidGiftCard(number: string): Promise<POSGiftCard>;
}
