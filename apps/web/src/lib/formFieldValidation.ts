/**
 * Shared client-side field validation for admin/CMS/storefront forms.
 * Prefer these helpers over one-off regex checks so QA rules stay consistent.
 */

/** Trim ends and collapse internal whitespace runs to a single space. */
export function normalizeWhitespace(value: string): string {
  return value.replace(/\u00A0/g, ' ').trim().replace(/\s+/g, ' ');
}

/** Local calendar date as YYYY-MM-DD (for `<input type="date" max={...}>`). */
export function todayDateInputValue(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Local datetime-local floor value (YYYY-MM-DDTHH:mm) for min=now style inputs. */
export function nowDateTimeLocalValue(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

export function isDateInputInFuture(value: string, now = new Date()): boolean {
  const t = value.trim();
  if (!t) return false;
  // Date-only: compare calendar days in local time
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    return t > todayDateInputValue(now);
  }
  const parsed = new Date(t);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getTime() > now.getTime();
}

export function isDateInputInPast(value: string, now = new Date()): boolean {
  const t = value.trim();
  if (!t) return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    return t < todayDateInputValue(now);
  }
  const parsed = new Date(t);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getTime() < now.getTime();
}

function isNumericOnly(t: string): boolean {
  return /^\d+$/.test(t) || /^\p{Nd}+$/u.test(t);
}

function hasLetter(t: string): boolean {
  return /\p{L}/u.test(t);
}

export type NameLikeOptions = {
  /** Default true */
  required?: boolean;
  /** When false (default), reject digit-only values */
  allowNumericOnly?: boolean;
  minLength?: number;
  maxLength?: number;
};

/**
 * Name-like labels: required/optional, must include a letter, reject numeric-only
 * and special-character-only strings. Callers should normalizeWhitespace before save.
 */
export function validateNameLike(
  value: string,
  label: string,
  opts: NameLikeOptions = {},
): string | null {
  const required = opts.required !== false;
  const t = normalizeWhitespace(value);
  if (!t) return required ? `${label} is required` : null;
  if (opts.minLength != null && t.length < opts.minLength) {
    return `${label} must be at least ${opts.minLength} characters`;
  }
  if (opts.maxLength != null && t.length > opts.maxLength) {
    return `${label} must be ${opts.maxLength} characters or fewer`;
  }
  if (!opts.allowNumericOnly && isNumericOnly(t)) {
    return `${label} cannot be numbers only`;
  }
  if (!hasLetter(t)) {
    return `${label} must include at least one letter`;
  }
  return null;
}

/** Optional free text: when provided, reject special-char-only / numeric-only. */
export function validateOptionalDescriptiveText(
  value: string,
  label: string,
): string | null {
  const t = normalizeWhitespace(value);
  if (!t) return null;
  if (isNumericOnly(t)) return `${label} cannot be numbers only`;
  if (!hasLetter(t)) return `${label} must include at least one letter`;
  return null;
}

/** http(s) URL validation. */
export function validateHttpUrl(
  value: string,
  label: string,
  opts: { required?: boolean } = {},
): string | null {
  const required = opts.required === true;
  const t = value.trim();
  if (!t) return required ? `${label} is required` : null;
  try {
    const u = new URL(t);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return `${label} must be an http:// or https:// URL`;
    }
    return null;
  } catch {
    return `${label} must be a valid URL`;
  }
}

/**
 * CTA / navigation URL: absolute http(s) or site-relative path starting with `/`.
 */
export function validateCtaUrl(
  value: string,
  label = 'CTA URL',
  opts: { required?: boolean } = {},
): string | null {
  const required = opts.required !== false;
  const t = value.trim();
  if (!t) return required ? `${label} is required` : null;
  if (t.startsWith('/')) {
    if (t.startsWith('//')) return `${label} must be a path or http(s) URL`;
    if (/\s/.test(t)) return `${label} cannot contain spaces`;
    return null;
  }
  return validateHttpUrl(t, label, { required: true });
}

/**
 * Department icon: inline SVG markup, or a URL ending in .svg (http/https or absolute path).
 */
export function validateSvgMarkupOrSvgUrl(
  value: string,
  label = 'Icon SVG',
): string | null {
  const t = value.trim();
  if (!t) return null;

  const lower = t.toLowerCase();
  if (
    /^https?:\/\//i.test(t) ||
    t.startsWith('/') ||
    t.startsWith('data:image/svg+xml')
  ) {
    if (t.startsWith('data:image/svg+xml')) return null;
    if (lower.includes('.svg')) return null;
    return `${label} URL must point to an .svg file`;
  }

  // Markup: must look like an SVG element (allow leading XML/doctype noise lightly)
  if (/<svg[\s>]/i.test(t) && /<\/svg>/i.test(t)) return null;
  if (/<svg[\s>\/]/i.test(t) && /\/>/i.test(t)) return null;
  return `${label} must be SVG markup or a .svg URL`;
}

/** Phone: optional; max 15 digits (E.164). Allows common formatting chars. */
export function validatePhoneMaxDigits(
  value: string,
  label = 'Phone number',
  maxDigits = 15,
): string | null {
  const t = value.trim().replace(/\u00A0/g, ' ');
  if (!t) return null;
  if (/[A-Za-z]/.test(t)) return `${label} cannot contain letters`;
  if (!/^[\d\s\-+().]+$/.test(t)) {
    return `${label} may only contain digits and + ( ) - . spaces`;
  }
  const digits = t.replace(/\D/g, '');
  if (digits.length === 0) return `${label} must include digits`;
  if (digits.length > maxDigits) {
    return `${label} cannot exceed ${maxDigits} digits`;
  }
  return null;
}

/**
 * Machine action codes (earn rules, etc.): letters, digits, underscore; must include a letter.
 */
export function validateActionCode(
  value: string,
  label = 'Action',
  opts: { required?: boolean } = {},
): string | null {
  const required = opts.required !== false;
  const t = value.trim();
  if (!t) return required ? `${label} is required` : null;
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(t)) {
    return `${label} may only use letters, numbers, and underscores, and must start with a letter`;
  }
  return null;
}

export function clampDateInputToToday(value: string, now = new Date()): string {
  const max = todayDateInputValue(now);
  if (!value) return value;
  return value > max ? max : value;
}
