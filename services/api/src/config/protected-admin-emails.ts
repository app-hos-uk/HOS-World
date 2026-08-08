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

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmailAddress(email: string | null | undefined): boolean {
  return !!email && EMAIL_PATTERN.test(email.trim());
}

/**
 * Resolve a safe outbound From address.
 * Falls back to DEFAULT_OUTBOUND_FROM when the candidate is a protected admin email
 * or is not a syntactically valid address (misconfigured integrations otherwise send
 * garbage senders such as "1", which SendGrid rejects).
 */
export function resolveOutboundFromEmail(
  candidate: string | null | undefined,
  fallback: string = DEFAULT_OUTBOUND_FROM,
): string {
  const fb = isValidEmailAddress(fallback) ? fallback.trim() : DEFAULT_OUTBOUND_FROM;
  const raw = candidate?.trim();
  if (!isValidEmailAddress(raw)) {
    return fb;
  }
  if (isProtectedAdminEmail(raw)) {
    return fb;
  }
  return raw as string;
}
