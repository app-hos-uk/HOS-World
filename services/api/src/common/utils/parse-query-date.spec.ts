import { parseQueryDate } from './parse-query-date';

describe('parseQueryDate', () => {
  it('parses date-only start as UTC midnight', () => {
    const d = parseQueryDate('2026-07-14', 'start');
    expect(d?.toISOString()).toBe('2026-07-14T00:00:00.000Z');
  });

  it('parses date-only end as end of UTC day', () => {
    const d = parseQueryDate('2026-07-14', 'end');
    expect(d?.toISOString()).toBe('2026-07-14T23:59:59.999Z');
  });

  it('parses ISO timestamps as-is', () => {
    const iso = '2026-07-14T20:00:00.000Z';
    expect(parseQueryDate(iso, 'start')?.toISOString()).toBe(iso);
    expect(parseQueryDate(iso, 'end')?.toISOString()).toBe(iso);
  });

  it('returns undefined for empty/invalid', () => {
    expect(parseQueryDate(undefined, 'start')).toBeUndefined();
    expect(parseQueryDate('not-a-date', 'end')).toBeUndefined();
  });
});
