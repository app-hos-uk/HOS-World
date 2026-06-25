/**
 * Keep in sync with API: services/api/src/config/protected-admin-emails.ts
 * Super-admin / platform owner accounts — login only, never used as outbound senders.
 */
export const PROTECTED_ADMIN_EMAILS = ['app@houseofspells.co.uk', 'mail@jsabu.com'] as const;

export function isProtectedAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return PROTECTED_ADMIN_EMAILS.some((e) => e.toLowerCase() === normalized);
}

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  return isProtectedAdminEmail(email);
}
