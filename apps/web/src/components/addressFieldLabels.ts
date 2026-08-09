/**
 * Region-aware address field labels. Keyed by ISO country (and common full names)
 * so UK/UAE/MY launches can flip copy without hunting form strings.
 */
export type AddressFieldLabels = {
  postalCode: string;
  state: string;
  phone: string;
  streetPlaceholder: string;
};

const BY_COUNTRY: Record<string, AddressFieldLabels> = {
  US: {
    postalCode: 'ZIP code',
    state: 'State',
    phone: 'Phone',
    streetPlaceholder: 'Street address',
  },
  'UNITED STATES': {
    postalCode: 'ZIP code',
    state: 'State',
    phone: 'Phone',
    streetPlaceholder: 'Street address',
  },
  GB: {
    postalCode: 'Postcode',
    state: 'County',
    phone: 'Mobile',
    streetPlaceholder: 'House number and street name',
  },
  UK: {
    postalCode: 'Postcode',
    state: 'County',
    phone: 'Mobile',
    streetPlaceholder: 'House number and street name',
  },
  'UNITED KINGDOM': {
    postalCode: 'Postcode',
    state: 'County',
    phone: 'Mobile',
    streetPlaceholder: 'House number and street name',
  },
  AE: {
    postalCode: 'Postal code',
    state: 'Emirate',
    phone: 'Mobile',
    streetPlaceholder: 'Street address',
  },
  'UNITED ARAB EMIRATES': {
    postalCode: 'Postal code',
    state: 'Emirate',
    phone: 'Mobile',
    streetPlaceholder: 'Street address',
  },
  MY: {
    postalCode: 'Postcode',
    state: 'State',
    phone: 'Mobile',
    streetPlaceholder: 'Street address',
  },
  MALAYSIA: {
    postalCode: 'Postcode',
    state: 'State',
    phone: 'Mobile',
    streetPlaceholder: 'Street address',
  },
};

const DEFAULT_LABELS: AddressFieldLabels = {
  postalCode: 'Postal code',
  state: 'State / Province / Region',
  phone: 'Phone',
  streetPlaceholder: 'Street address',
};

/** Map platform region country code → default select option value used in storefront forms. */
export function regionCountryToFormValue(country: string | undefined | null): string {
  const c = (country || '').trim().toUpperCase();
  if (c === 'US' || c === 'UNITED STATES') return 'United States';
  if (c === 'AE' || c === 'UNITED ARAB EMIRATES') return 'United Arab Emirates';
  if (c === 'GB' || c === 'UK' || c === 'UNITED KINGDOM') return 'United Kingdom';
  if (c === 'MY' || c === 'MALAYSIA') return 'Malaysia';
  return '';
}

export function getAddressFieldLabels(country?: string | null): AddressFieldLabels {
  const key = (country || '').trim().toUpperCase();
  if (key && BY_COUNTRY[key]) return BY_COUNTRY[key];
  return DEFAULT_LABELS;
}
