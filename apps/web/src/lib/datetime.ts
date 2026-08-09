import { formatRelative as formatRelativeCore, type FormatDateOptions } from '@hos-marketplace/utils';
import { getRegionConfig } from '@/lib/regionConfig';

export type { FormatDateOptions };

function resolveLocaleTimezone(opts?: FormatDateOptions & { locale?: string; timeZone?: string }) {
  const region = getRegionConfig();
  const { locale: localeOverride, timeZone: tzOverride, ...formatOpts } = opts || {};
  return {
    locale: localeOverride ?? region.locale,
    timeZone: tzOverride ?? region.timezone,
    formatOpts,
  };
}

/**
 * A bare "YYYY-MM-DD" is parsed as UTC midnight. Rendering that in a behind-UTC zone such as
 * America/New_York moves it to the previous evening and displays the day before, so date-only
 * values are pinned to UTC and treated as the calendar day they state.
 */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function isDateOnly(value: Date | string | number): boolean {
  return typeof value === 'string' && DATE_ONLY.test(value.trim());
}

/**
 * Fields that select which parts of a date are shown. When a caller names any of them they are
 * describing the whole shape they want, so the defaults must not be merged in — otherwise
 * asking for day and month still yields a year, and there is no way to remove it.
 */
const DATE_SHAPE_KEYS = ['year', 'month', 'day', 'weekday', 'era', 'dateStyle'] as const;

function callerChoseShape(opts?: Intl.DateTimeFormatOptions): boolean {
  return !!opts && DATE_SHAPE_KEYS.some((key) => opts[key] !== undefined);
}

/**
 * Build the formatter here rather than delegating to the shared helper, which merges its own
 * year/month/day defaults and so cannot be narrowed: asking it for day and month still returns
 * a year. Chart axes and compact labels need to drop fields, so the caller has to win.
 */
function format(
  value: Date | string | number,
  locale: string,
  timeZone: string,
  defaults: Intl.DateTimeFormatOptions,
  formatOpts: Intl.DateTimeFormatOptions,
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat(locale, {
    ...(callerChoseShape(formatOpts) ? {} : defaults),
    // Unconditional for date-only input: such a value names a calendar day rather than an
    // instant, so there is nothing to convert and any timezone would only shift it off the day
    // it states. Callers reach this via useDateTime, which always supplies a timezone, so
    // deferring to an explicit override here would reintroduce the off-by-one-day bug.
    timeZone: isDateOnly(value) ? 'UTC' : timeZone,
    ...formatOpts,
  }).format(date);
}

/** Format a calendar date using platform locale + timezone by default. */
export function formatDate(
  value: Date | string | number | null | undefined,
  opts?: FormatDateOptions & { locale?: string; timeZone?: string },
): string {
  if (value == null || value === '') return '—';
  const { locale, timeZone, formatOpts } = resolveLocaleTimezone(opts);
  return format(
    value,
    locale,
    timeZone,
    { day: '2-digit', month: 'short', year: 'numeric' },
    formatOpts,
  );
}

/** Format date + time using platform locale + timezone by default. */
export function formatDateTime(
  value: Date | string | number | null | undefined,
  opts?: FormatDateOptions & { locale?: string; timeZone?: string },
): string {
  if (value == null || value === '') return '—';
  const { locale, timeZone, formatOpts } = resolveLocaleTimezone(opts);
  return format(
    value,
    locale,
    timeZone,
    { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' },
    formatOpts,
  );
}

/**
 * Time of day only, in the platform timezone.
 *
 * Separate from formatDateTime because that helper always supplies year/month/day defaults;
 * passing only hour and minute to it narrows nothing and still renders the full date.
 */
export function formatTime(
  value: Date | string | number | null | undefined,
  opts?: FormatDateOptions & { locale?: string; timeZone?: string },
): string {
  if (value == null || value === '') return '—';
  const { locale, timeZone, formatOpts } = resolveLocaleTimezone(opts);
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
    ...formatOpts,
  }).format(date);
}

/**
 * The calendar day (YYYY-MM-DD) a moment falls on in the platform timezone.
 *
 * For grouping records into business days. Deriving the day from browser-local date parts
 * instead would bucket a US store's takings by the viewer's calendar, so the same data would
 * group differently depending on where the admin happens to be sitting.
 */
export function calendarDay(
  value: Date | string | number,
  timeZone?: string,
): string {
  const region = getRegionConfig();
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timeZone ?? region.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/**
 * Step a YYYY-MM-DD label by whole calendar days.
 *
 * Pure label arithmetic, so it is unaffected by timezones and DST. Deriving a day sequence by
 * subtracting from a Date instead would build it in the browser's calendar, which drifts from
 * the platform's whenever the two disagree about what day it is.
 */
export function addCalendarDays(day: string, delta: number): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

/** How far the given zone sits from UTC at a specific instant, accounting for DST. */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);

  const p = (type: string) => Number(parts.find((x) => x.type === type)?.value ?? '0');
  // hour renders as 24 at midnight under hour12:false in some ICU builds.
  const asUtc = Date.UTC(p('year'), p('month') - 1, p('day'), p('hour') % 24, p('minute'), p('second'));
  return asUtc - instant.getTime();
}

/**
 * The instant at which a calendar day begins in the platform timezone.
 *
 * Browser-local midnight is a different moment, so using it to bound a query would fetch a
 * window that does not line up with the business days the results are grouped into.
 */
export function startOfDayInRegion(day: string, timeZone?: string): Date {
  const region = getRegionConfig();
  const tz = timeZone ?? region.timezone;
  const utcMidnight = new Date(`${day}T00:00:00.000Z`);

  const offset = zoneOffsetMs(utcMidnight, tz);
  const candidate = new Date(utcMidnight.getTime() - offset);

  // One refinement: on a DST boundary the offset at the candidate differs from the offset at
  // the initial guess, and the guess would land an hour out.
  const refined = zoneOffsetMs(candidate, tz);
  return refined === offset ? candidate : new Date(utcMidnight.getTime() - refined);
}

/** The last representable instant of a calendar day in the platform timezone. */
export function endOfDayInRegion(day: string, timeZone?: string): Date {
  const nextDay = new Date(`${day}T00:00:00.000Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const nextDayStr = nextDay.toISOString().slice(0, 10);
  return new Date(startOfDayInRegion(nextDayStr, timeZone).getTime() - 1);
}

/** Relative time (e.g. "3 days ago") using platform locale by default. */
export function formatRelative(
  value: Date | string | number | null | undefined,
  locale?: string,
): string {
  if (value == null || value === '') return '—';
  const region = getRegionConfig();
  return formatRelativeCore(value, locale ?? region.locale);
}
