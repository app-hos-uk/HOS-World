import {
  formatDate,
  formatDateTime,
  formatTime,
  formatRelative,
  calendarDay,
  startOfDayInRegion,
  endOfDayInRegion,
} from '@/lib/datetime';
import { DEFAULT_REGION, setRegionConfig } from '@/lib/regionConfig';

/** Fixed UTC instant — assertions always pass an explicit timeZone to avoid CI TZ flakes. */
const INSTANT = '2024-06-15T18:30:00.000Z';

describe('datetime formatters', () => {
  beforeEach(() => {
    setRegionConfig(DEFAULT_REGION);
  });

  it('formatDate produces stable US-locale output with an explicit timezone', () => {
    const formatted = formatDate(INSTANT, {
      locale: 'en-US',
      timeZone: 'America/New_York',
    });
    // 18:30 UTC → 14:30 EDT on 15 Jun 2024
    expect(formatted).toMatch(/Jun/i);
    expect(formatted).toContain('15');
    expect(formatted).toContain('2024');
    expect(formatted).not.toMatch(/Invalid Date/i);
  });

  it('formatDateTime produces stable US-locale output with an explicit timezone', () => {
    const formatted = formatDateTime(INSTANT, {
      locale: 'en-US',
      timeZone: 'UTC',
    });
    expect(formatted).toMatch(/June|Jun/i);
    expect(formatted).toContain('15');
    expect(formatted).toContain('2024');
    // 18:30 UTC — hour may be 6 (12h) or 18 (24h) depending on ICU options; assert minutes
    expect(formatted).toMatch(/6:30|18:30/);
    expect(formatted).not.toMatch(/Invalid Date/i);
  });

  it('returns em-dash for null, undefined, and empty input', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
    expect(formatDate('')).toBe('—');
    expect(formatDateTime(null)).toBe('—');
    expect(formatDateTime(undefined)).toBe('—');
    expect(formatDateTime('')).toBe('—');
    expect(formatRelative(null)).toBe('—');
    expect(formatRelative(undefined)).toBe('—');
    expect(formatRelative('')).toBe('—');
  });

  it('returns em-dash for invalid date strings rather than Invalid Date', () => {
    expect(formatDate('not-a-date')).toBe('—');
    expect(formatDateTime('not-a-date')).toBe('—');
    expect(formatRelative('not-a-date')).toBe('—');
  });

  describe('date-only values', () => {
    // "2026-08-09" parses as UTC midnight; rendering it in a behind-UTC zone previously
    // displayed 8 August.
    it('keeps the stated day in a behind-UTC platform timezone', () => {
      setRegionConfig({ ...DEFAULT_REGION, locale: 'en-US', timezone: 'America/New_York' });
      expect(formatDate('2026-08-09')).toContain('09');
      expect(formatDate('2026-08-09')).toMatch(/Aug/i);
    });

    it('keeps the stated day in an ahead-of-UTC platform timezone', () => {
      setRegionConfig({ ...DEFAULT_REGION, locale: 'en-US', timezone: 'Asia/Dubai' });
      expect(formatDate('2026-01-01')).toContain('01');
      expect(formatDate('2026-01-01')).toMatch(/Jan/i);
    });

    it('still shifts values that carry an explicit time', () => {
      setRegionConfig({ ...DEFAULT_REGION, locale: 'en-US', timezone: 'America/New_York' });
      // 02:00 UTC on 9 Aug is 22:00 on 8 Aug in New York, and should render as the 8th.
      expect(formatDate('2026-08-09T02:00:00.000Z')).toContain('08');
    });

    // useDateTime always passes an explicit timezone, so an override must not be able to
    // shift a date-only value off the day it names.
    it('ignores an explicit timeZone override rather than shifting the stated day', () => {
      setRegionConfig({ ...DEFAULT_REGION, locale: 'en-US', timezone: 'UTC' });
      expect(formatDate('2026-08-09', { timeZone: 'Pacific/Kiritimati' })).toContain('09');
      expect(formatDate('2026-08-09', { timeZone: 'Pacific/Midway' })).toContain('09');
    });
  });

  // Both this helper and the shared one it used to delegate to injected year/month/day, so a
  // caller asking for a short axis label still got a year they could not remove.
  describe('caller-specified date shape', () => {
    it('omits the year when only day and month are requested', () => {
      setRegionConfig({ ...DEFAULT_REGION, locale: 'en-US', timezone: 'UTC' });
      const out = formatDate('2026-08-09', { day: '2-digit', month: 'short' });
      expect(out).toMatch(/Aug/i);
      expect(out).toContain('09');
      expect(out).not.toMatch(/2026/);
    });

    it('renders year alone when that is all that is asked for', () => {
      setRegionConfig({ ...DEFAULT_REGION, locale: 'en-US', timezone: 'UTC' });
      expect(formatDate('2026-08-09', { year: 'numeric' })).toBe('2026');
    });

    it('still applies the full default shape when no shape is given', () => {
      setRegionConfig({ ...DEFAULT_REGION, locale: 'en-US', timezone: 'UTC' });
      const out = formatDate('2026-08-09');
      expect(out).toMatch(/Aug/i);
      expect(out).toContain('09');
      expect(out).toContain('2026');
    });
  });

  describe('formatTime', () => {
    // formatDateTime always supplies year/month/day defaults, so narrowing it to time-only
    // options is impossible; this helper exists to actually drop the date.
    it('renders time without the date', () => {
      setRegionConfig({ ...DEFAULT_REGION, locale: 'en-US', timezone: 'UTC' });
      const out = formatTime('2026-08-09T14:30:00.000Z');
      expect(out).toMatch(/2:30|14:30/);
      expect(out).not.toMatch(/2026/);
      expect(out).not.toMatch(/Aug/i);
    });

    it('renders in the platform timezone', () => {
      setRegionConfig({ ...DEFAULT_REGION, locale: 'en-US', timezone: 'America/New_York' });
      // 14:30 UTC is 10:30 EDT.
      expect(formatTime('2026-08-09T14:30:00.000Z')).toMatch(/10:30/);
    });

    it('returns em-dash for empty and invalid input', () => {
      expect(formatTime(null)).toBe('—');
      expect(formatTime('')).toBe('—');
      expect(formatTime('not-a-date')).toBe('—');
    });
  });

  describe('day bounds in the platform timezone', () => {
    it('starts the day at local midnight in a behind-UTC zone', () => {
      // Midnight on 9 Aug in New York (EDT, UTC-4) is 04:00 UTC.
      expect(startOfDayInRegion('2026-08-09', 'America/New_York').toISOString()).toBe(
        '2026-08-09T04:00:00.000Z',
      );
    });

    it('starts the day at local midnight in an ahead-of-UTC zone', () => {
      // Midnight on 9 Aug in Dubai (UTC+4) is 20:00 UTC on the 8th.
      expect(startOfDayInRegion('2026-08-09', 'Asia/Dubai').toISOString()).toBe(
        '2026-08-08T20:00:00.000Z',
      );
    });

    it('ends the day one millisecond before the next begins', () => {
      const end = endOfDayInRegion('2026-08-09', 'America/New_York');
      const nextStart = startOfDayInRegion('2026-08-10', 'America/New_York');
      expect(nextStart.getTime() - end.getTime()).toBe(1);
    });

    it('produces bounds that agree with calendarDay', () => {
      const tz = 'America/New_York';
      expect(calendarDay(startOfDayInRegion('2026-08-09', tz), tz)).toBe('2026-08-09');
      expect(calendarDay(endOfDayInRegion('2026-08-09', tz), tz)).toBe('2026-08-09');
    });

    // Spring-forward in the US is 8 March 2026, when local time jumps 02:00 -> 03:00.
    it('handles a daylight-saving transition', () => {
      const tz = 'America/New_York';
      expect(calendarDay(startOfDayInRegion('2026-03-08', tz), tz)).toBe('2026-03-08');
      expect(calendarDay(endOfDayInRegion('2026-03-08', tz), tz)).toBe('2026-03-08');
    });
  });

  describe('calendarDay', () => {
    it('reports the business day in the platform timezone, not the viewer local one', () => {
      setRegionConfig({ ...DEFAULT_REGION, timezone: 'America/New_York' });
      // 02:00 UTC on 9 Aug is still the evening of the 8th in New York.
      expect(calendarDay('2026-08-09T02:00:00.000Z')).toBe('2026-08-08');
    });

    it('groups a late-evening US sale onto the same day it was made', () => {
      setRegionConfig({ ...DEFAULT_REGION, timezone: 'America/New_York' });
      expect(calendarDay('2026-08-09T23:30:00.000Z')).toBe('2026-08-09');
    });

    it('accepts an explicit timezone override', () => {
      expect(calendarDay('2026-08-09T02:00:00.000Z', 'Asia/Dubai')).toBe('2026-08-09');
    });

    it('returns an empty string for an invalid date', () => {
      expect(calendarDay('not-a-date')).toBe('');
    });
  });
});
