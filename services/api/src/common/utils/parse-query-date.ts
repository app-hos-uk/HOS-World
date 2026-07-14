/**
 * Parse finance/query date strings into inclusive Date bounds.
 * Date-only values (YYYY-MM-DD) use full UTC day bounds so endDate
 * does not truncate to midnight at the start of that day.
 * Full ISO timestamps are parsed as-is.
 */
export function parseQueryDate(
  value: string | undefined,
  bound: 'start' | 'end',
): Date | undefined {
  if (!value?.trim()) return undefined;
  const trimmed = value.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return bound === 'start'
      ? new Date(`${trimmed}T00:00:00.000Z`)
      : new Date(`${trimmed}T23:59:59.999Z`);
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}
