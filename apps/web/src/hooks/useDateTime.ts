'use client';

import { useCallback } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import {
  formatDate as formatDateCore,
  formatDateTime as formatDateTimeCore,
  formatTime as formatTimeCore,
  formatRelative as formatRelativeCore,
  type FormatDateOptions,
} from '@/lib/datetime';

/** Client hook: date formatters bound to live region locale/timezone. */
export function useDateTime() {
  const { locale, timezone } = useCurrency();

  const formatDate = useCallback(
    (
      value: Date | string | number | null | undefined,
      opts?: FormatDateOptions & { locale?: string; timeZone?: string },
    ) =>
      formatDateCore(value, {
        locale,
        timeZone: timezone,
        ...opts,
      }),
    [locale, timezone],
  );

  const formatDateTime = useCallback(
    (
      value: Date | string | number | null | undefined,
      opts?: FormatDateOptions & { locale?: string; timeZone?: string },
    ) =>
      formatDateTimeCore(value, {
        locale,
        timeZone: timezone,
        ...opts,
      }),
    [locale, timezone],
  );

  const formatTime = useCallback(
    (
      value: Date | string | number | null | undefined,
      opts?: FormatDateOptions & { locale?: string; timeZone?: string },
    ) =>
      formatTimeCore(value, {
        locale,
        timeZone: timezone,
        ...opts,
      }),
    [locale, timezone],
  );

  const formatRelative = useCallback(
    (value: Date | string | number | null | undefined, localeOverride?: string) =>
      formatRelativeCore(value, localeOverride ?? locale),
    [locale],
  );

  return { formatDate, formatDateTime, formatTime, formatRelative, locale, timezone };
}
