/** Roles allowed to list/view all marketplace orders (staff only). */
export const STAFF_ORDER_ROLES = [
  'ADMIN',
  'FINANCE',
  'FULFILLMENT',
  'PROCUREMENT',
] as const;

export type StaffOrderRole = (typeof STAFF_ORDER_ROLES)[number];

export function canAccessAllOrders(role: string): boolean {
  return STAFF_ORDER_ROLES.includes(role as StaffOrderRole);
}
