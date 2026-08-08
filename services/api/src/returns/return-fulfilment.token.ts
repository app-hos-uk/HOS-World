/**
 * The fulfilment side of a return — restock and the order status rules — lives in
 * ReturnsService, which already depends on the finance RefundsService. Finance
 * resolves it through this token so neither file has to import the other.
 */
export const RETURN_FULFILMENT = 'RETURN_FULFILMENT';

export interface ReturnFulfilment {
  finalizeSettledReturn(returnId: string): Promise<void>;
}
