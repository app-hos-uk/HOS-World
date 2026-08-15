/**
 * Customer PII masking for staff-facing responses.
 *
 * Shared so every staff-facing endpoint applies one policy. Masking must happen server-side:
 * store staff can call these APIs directly, so anything the response contains is disclosed
 * regardless of what the UI chooses to render.
 */

export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

export function maskPhoneLast4(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '****';
  return `***${digits.slice(-4)}`;
}

export function maskCardNumber(card: string | null | undefined): string | null {
  if (!card) return null;
  const trimmed = card.trim();
  if (trimmed.length <= 4) return '****';
  return `****${trimmed.slice(-4)}`;
}

export function lastInitial(lastName: string | null | undefined): string | null {
  if (!lastName?.trim()) return null;
  return lastName.trim().charAt(0).toUpperCase();
}
