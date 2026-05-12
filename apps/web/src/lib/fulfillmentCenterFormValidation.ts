/** Shared validation for fulfillment center forms (admin + fulfillment UI). */

export function validateCenterName(name: string): string | null {
  const t = name.trim();
  if (!t) return 'Name is required';
  if (/^\d+$/.test(t)) return 'Name cannot be numbers only';
  if (!/\p{L}/u.test(t)) return 'Name must include at least one letter';
  return null;
}

export function validateCityOrCountry(value: string, label: string): string | null {
  const t = value.trim();
  if (!t) return `${label} is required`;
  if (/^\d+$/.test(t)) return `${label} cannot be numbers only`;
  if (!/\p{L}/u.test(t)) return `${label} must include at least one letter`;
  return null;
}

/** Optional; when set, allow typical phone chars only (no letters). */
export function validateContactPhone(phone: string): string | null {
  const t = phone.trim();
  if (!t) return null;
  if (/[A-Za-z]/.test(t)) return 'Phone number cannot contain letters';
  if (!/^\+?(?=.*\d)[()[\]\d\s.-]{8,24}$/.test(t)) {
    return 'Enter a valid phone number (digits, spaces, +, parentheses, hyphens)';
  }
  return null;
}

/** Optional; reject letter-only strings (e.g. "abcdef"). */
export function validatePostalCode(postalCode: string): string | null {
  const t = postalCode.trim();
  if (!t) return null;
  if (/^[A-Za-z\s-]+$/i.test(t)) return 'Postal code cannot be letters only';
  if (!/^(?!^[A-Za-z\s-]+$)[A-Za-z0-9](?:[A-Za-z0-9 -]*[A-Za-z0-9])?$/i.test(t)) {
    return 'Invalid postal code format';
  }
  return null;
}

export function validateFulfillmentCenterFields(input: {
  name: string;
  city: string;
  country: string;
  postalCode?: string;
  contactPhone?: string;
}): string | null {
  return (
    validateCenterName(input.name) ||
    validateCityOrCountry(input.city, 'City') ||
    validateCityOrCountry(input.country, 'Country') ||
    validatePostalCode(input.postalCode ?? '') ||
    validateContactPhone(input.contactPhone ?? '') ||
    null
  );
}
