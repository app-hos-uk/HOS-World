/** Default outbound sender — the only sender until per-event IDs are added. */
export const DEFAULT_OUTBOUND_FROM = 'noreply@houseofspells.com';

const FALLBACK_PROTECTED_EMAILS = ['app@houseofspells.co.uk', 'mail@jsabu.com'];

function getProtectedAdminEmails(): string[] {
  const envEmails = process.env.PROTECTED_ADMIN_EMAILS;
  if (envEmails) {
    return envEmails.split(',').map(e => e.trim().toLowerCase());
  }
  return FALLBACK_PROTECTED_EMAILS;
}

export function isProtectedAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getProtectedAdminEmails().includes(email.trim().toLowerCase());
}

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  return isProtectedAdminEmail(email);
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Normalize common “Display Name <email@domain>” / mailto forms to a bare address.
 */
export function normalizeEmailAddress(email: string | null | undefined): string | null {
  if (email == null) return null;
  let raw = String(email).trim();
  if (!raw) return null;
  const angle = raw.match(/<([^<>@\s]+@[^<>@\s]+\.[^<>@\s]+)>/);
  if (angle?.[1]) raw = angle[1].trim();
  if (/^mailto:/i.test(raw)) raw = raw.slice(7).trim();
  // Strip wrapping quotes
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    raw = raw.slice(1, -1).trim();
  }
  return raw || null;
}

export function isValidEmailAddress(email: string | null | undefined): boolean {
  const normalized = normalizeEmailAddress(email);
  return !!normalized && EMAIL_PATTERN.test(normalized);
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
  const fbNorm = normalizeEmailAddress(fallback);
  // Never allow a protected admin login address (or other invalid value) as the
  // outbound fallback — those accounts are custodian logins, not senders.
  const fb =
    fbNorm && isValidEmailAddress(fbNorm) && !isProtectedAdminEmail(fbNorm)
      ? fbNorm
      : DEFAULT_OUTBOUND_FROM;
  const raw = normalizeEmailAddress(candidate);
  if (!isValidEmailAddress(raw) || isProtectedAdminEmail(raw)) {
    return fb;
  }
  return raw as string;
}
