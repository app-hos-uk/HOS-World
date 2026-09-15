'use client';

import { COUNTRIES } from '@/lib/countries';

interface CountrySelectProps {
  id?: string;
  name?: string;
  value?: string;
  onChange?: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

/**
 * Shared country selector with ISO 3166-1 alpha-2 codes
 * Use this component everywhere country input is needed for consistency
 */
export function CountrySelect({
  id = 'country',
  name = 'countryCode',
  value,
  onChange,
  required = false,
  disabled = false,
  className = 'w-full px-3 py-2.5 text-sm bg-hos-bg-secondary border border-hos-border-input rounded-lg focus:border-hos-gold focus:ring-2 focus:ring-hos-gold/20 outline-none transition-all',
  placeholder = 'Select country',
}: CountrySelectProps) {
  return (
    <select
      id={id}
      name={name}
      value={value}
      onChange={onChange}
      required={required}
      disabled={disabled}
      className={className}
    >
      <option value="">{placeholder}</option>
      {COUNTRIES.map((country) => (
        <option key={country.code} value={country.code}>
          {country.name}
        </option>
      ))}
    </select>
  );
}
