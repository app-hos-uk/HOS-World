/**
 * Client-side checks aligned with seller profile API validation (`update-seller.dto`).
 */

export const SELLER_PROFILE_HINTS = {
  labelLetters: (label: string) =>
    `${label} must include at least one letter and cannot be numeric-only (digits in any script).`,
  phone:
    'Contact phone may only contain digits and spacing or + ( ) - ., with 7–15 digits total.',
  postal:
    'Postal code must include at least one numeric digit and use letters, digits, spaces, or hyphens (2–15 characters).',
};

/** Non-empty trimmed value must include a Unicode letter and not be decimal digits only (any script). */
export function optionalLabelRequiresLettersOk(value: string): boolean {
  const t = value.trim();
  if (!t.length) return true;
  if (/^\d+$/.test(t) || /^\p{Nd}+$/u.test(t)) return false;
  return /\p{L}/u.test(t);
}

export function optionalPostalCodeOk(value: string): boolean {
  const t = value.trim();
  if (!t.length) return true;
  if (!/^[\p{L}\p{N}](?:[\p{L}\p{N}\s\-]{0,13}[\p{L}\p{N}])?$/u.test(t)) return false;
  return /\p{Nd}/u.test(t);
}

/** Allow + digit whitespace ( ) . - ; require 7–15 ASCII digits total. No letters or stray symbols. */
export function optionalPhoneOk(value: string): boolean {
  const t = value.trim().replace(/\u00A0/g, ' ');
  if (!t.length) return true;
  if (!/^[\d\s\-+().]+$/.test(t)) return false;
  const digits = t.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

export function sanitizeOpsPhoneInput(value: string): string {
  return value.replace(/\u00A0/g, ' ').replace(/[^\d\s\-+().]/g, '');
}

export function sanitizePostalInput(value: string): string {
  return value.replace(/[^\p{L}\p{N}\s\-]/gu, '');
}
