/**
 * Centralised role constants.
 *
 * UserRole `SELLER` was the original catch-all for anyone who sold on the
 * platform.  It was replaced by the explicit `B2C_SELLER` (direct-to-consumer)
 * and `WHOLESALER` (B2B supply-chain) roles.  Any remaining `SELLER` users
 * should be migrated with `pnpm db:migrate-seller-role`.
 *
 * Use these constants everywhere instead of hand-written role arrays so
 * additions or removals propagate automatically.
 */

/** Roles that represent a seller on the marketplace (B2C or wholesale). */
export const SELLER_ROLES = ['B2C_SELLER', 'WHOLESALER'] as const;

/** Seller roles that operate direct-to-consumer storefronts only. */
export const B2C_SELLER_ROLES = ['B2C_SELLER'] as const;

/** Seller roles plus ADMIN — the most common guard combination. */
export const SELLER_AND_ADMIN_ROLES = ['ADMIN', ...SELLER_ROLES] as const;

/** Staff roles that can manage orders and mark notes as internal. */
export const ORDER_STAFF_ROLES = ['ADMIN', ...SELLER_ROLES, 'FULFILLMENT'] as const;

/** Returns true when `role` is any seller variant. */
export function isSellerRole(role: string): boolean {
  return (SELLER_ROLES as readonly string[]).includes(role);
}
