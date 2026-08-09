'use client';

import { useCallback } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import {
  formatCount as formatCountCore,
  formatMoney as formatMoneyCore,
  formatMoneyCompact as formatMoneyCompactCore,
} from '@/lib/money';

/** Client hook: re-renders when region config loads; formatters stay region-aware. */
export function useMoney() {
  const { locale, regionCurrency, country, timezone } = useCurrency();

  const formatMoney = useCallback(
    (amount: number | string | null | undefined, currency?: string, localeOverride?: string) =>
      formatMoneyCore(amount, currency ?? regionCurrency, localeOverride ?? locale),
    [locale, regionCurrency],
  );

  const formatCount = useCallback(
    (value: number | string | null | undefined, localeOverride?: string) =>
      formatCountCore(value, localeOverride ?? locale),
    [locale],
  );

  const formatMoneyCompact = useCallback(
    (amount: number | string | null | undefined, currency?: string, localeOverride?: string) =>
      formatMoneyCompactCore(amount, currency ?? regionCurrency, localeOverride ?? locale),
    [locale, regionCurrency],
  );

  return {
    formatMoney,
    formatMoneyCompact,
    formatCount,
    currency: regionCurrency,
    locale,
    country,
    timezone,
  };
}
