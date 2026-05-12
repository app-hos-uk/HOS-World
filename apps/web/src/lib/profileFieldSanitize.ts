/**
 * Client-side sanitizers aligned with profile/address validation rules:
 * latin letters + spaces/apostrophe/period/hyphen for names/city/state,
 * digits + phone punctuation for tel fields,
 * digits + hyphen/space only for postal codes (no letters).
 */

const NAME_ALLOWED = /[^\p{L}\s'.-]/gu;

export function sanitizeLatinPersonName(value: string, maxLen = 50): string {
  return value.replace(NAME_ALLOWED, '').slice(0, maxLen);
}

export function sanitizeLatinCityOrState(value: string, maxLen = 80): string {
  return value.replace(NAME_ALLOWED, '').slice(0, maxLen);
}

/** E.164-ish display: digits, spaces, hyphen, parentheses, optional + (same family as WhatsApp DTO). */
export function sanitizeTelInput(value: string, maxLen = 32): string {
  return value.replace(/[^\d+\s()-]/g, '').slice(0, maxLen);
}

export function sanitizePostalCode(value: string, maxLen = 16): string {
  return value.replace(/[^\w\d\s-]/g, '').slice(0, maxLen);
}
