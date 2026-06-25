/**
 * Super-admin / platform owner accounts.
 * These are login-only custodian accounts — NEVER used as outbound email senders.
 * All outbound mail uses noreply@houseofspells.com (or later, event-specific sender IDs).
 */
export const PROTECTED_ADMIN_EMAILS = ['app@houseofspells.co.uk', 'mail@jsabu.com'] as const;

/** Default outbound sender — the only sender until per-event IDs are added. */
export const DEFAULT_OUTBOUND_FROM = 'noreply@houseofspells.com';

export function isProtectedAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return PROTECTED_ADMIN_EMAILS.some((e) => e.toLowerCase() === normalized);
}

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  return isProtectedAdminEmail(email);
}
