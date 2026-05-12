import {
  validateCenterName,
  validateCityOrCountry,
  validateContactPhone,
  validatePostalCode,
} from '@/lib/fulfillmentCenterFormValidation';

/** Optional state/region: if provided, must not be digits-only and must include a letter. */
export function validateOptionalStateRegion(value: string): string | null {
  const t = value.trim();
  if (!t) return null;
  if (/^\d+$/.test(t)) return 'State/Region cannot be numbers only';
  if (!/\p{L}/u.test(t)) return 'State/Region must include at least one letter';
  return null;
}

/** Optional manager name: if provided, must not be numbers-only and must include a letter. */
export function validateManagerName(value: string): string | null {
  const t = value.trim();
  if (!t) return null;
  if (/^\d+$/.test(t)) return 'Manager name cannot be numbers only';
  if (!/\p{L}/u.test(t)) return 'Manager name must include at least one letter';
  return null;
}

export function validatePostalCodeRequired(postalCode: string): string | null {
  const t = postalCode.trim();
  if (!t) return 'Postal code is required';
  return validatePostalCode(t);
}

export function validateWarehouseForm(input: {
  name: string;
  city: string;
  state?: string;
  country: string;
  postalCode: string;
  contactPhone?: string;
  managerName?: string;
}): string | null {
  return (
    validateCenterName(input.name) ||
    validateCityOrCountry(input.city, 'City') ||
    validateCityOrCountry(input.country, 'Country') ||
    validateOptionalStateRegion(input.state ?? '') ||
    validatePostalCodeRequired(input.postalCode) ||
    validateContactPhone(input.contactPhone ?? '') ||
    validateManagerName(input.managerName ?? '') ||
    null
  );
}
