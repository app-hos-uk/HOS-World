/**
 * Named ownership predicates extracted from the ~150 inline ForbiddenException
 * checks. Keep these pure so PolicyService and unit tests can share them.
 */

export const SELLER_ROLES = new Set(['SELLER', 'B2C_SELLER', 'WHOLESALER']);
export const STAFF_ORDER_ROLES = new Set(['ADMIN', 'FINANCE', 'FULFILLMENT', 'PROCUREMENT']);

export function isSellerRole(role?: string | null): boolean {
  return !!role && SELLER_ROLES.has(role.toUpperCase());
}

export function canAccessAllOrders(role?: string | null): boolean {
  return !!role && STAFF_ORDER_ROLES.has(role.toUpperCase());
}

export interface OrderLike {
  userId?: string | null;
  sellerId?: string | null;
  parentOrderId?: string | null;
  childSellerIds?: string[];
}

/**
 * Direct seller assignment OR child-order access (parent sees children).
 * Used by orders, returns, cancellations, invoices.
 */
export function sellerOwnsOrder(order: OrderLike, sellerId: string | null | undefined): boolean {
  if (!sellerId) return false;
  if (order.sellerId && order.sellerId === sellerId) return true;
  if (order.childSellerIds?.includes(sellerId)) return true;
  return false;
}

export function customerOwnsOrder(order: OrderLike, userId: string | null | undefined): boolean {
  return !!userId && order.userId === userId;
}

export function userOwnsRecord(
  recordUserId: string | null | undefined,
  userId: string | null | undefined,
): boolean {
  return !!recordUserId && !!userId && recordUserId === userId;
}

export function staffOwnsStore(
  userStoreId: string | null | undefined,
  storeId: string | null | undefined,
): boolean {
  return !!userStoreId && !!storeId && userStoreId === storeId;
}
