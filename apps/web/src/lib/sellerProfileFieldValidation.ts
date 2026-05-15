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

/**
 * Sanitize label fields (business name, city, bank name, account holder, contact name, state).
 * Allows letters, numbers, spaces, hyphens, ampersands, periods, commas, and apostrophes.
 * Prevents input from becoming numeric-only by blocking digit entry when no letters present.
 */
export function sanitizeLabelInput(value: string, prevValue: string = ''): string {
  // Allow common label characters
  const sanitized = value.replace(/[^\p{L}\p{N}\s\-&.,'']/gu, '');
  // If result would be numeric-only and non-empty, reject the change
  const trimmed = sanitized.trim();
  if (trimmed.length > 0 && /^\p{Nd}+$/u.test(trimmed)) {
    // Check if user is trying to add more digits to an already numeric-only string
    // Allow if prev had letters (user is deleting), reject if adding digits to numeric
    const prevTrimmed = prevValue.trim();
    if (prevTrimmed.length === 0 || /^\p{Nd}+$/u.test(prevTrimmed)) {
      // Prev was empty or numeric-only, don't allow more numeric-only
      return prevValue;
    }
  }
  return sanitized;
}

/**
 * Check if a label value is currently invalid (for showing real-time warning).
 * Returns true if the value is non-empty but numeric-only (missing letters).
 */
export function isLabelInvalid(value: string): boolean {
  const t = value.trim();
  if (!t.length) return false;
  return /^\p{Nd}+$/u.test(t) || !(/\p{L}/u.test(t));
}

/**
 * Check if postal code is currently invalid (for showing real-time warning).
 * Returns true if non-empty but has no digits.
 */
export function isPostalInvalid(value: string): boolean {
  const t = value.trim();
  if (!t.length) return false;
  return !/\p{Nd}/u.test(t);
}
