/**
 * Parses a string value as a boolean.
 * Returns true for: 'true', 'TRUE', 'True', '1', 'yes', 'YES', 'on', 'ON'
 * Returns false for everything else including undefined/null/empty string.
 */
export function isTruthy(value: string | undefined | null): boolean {
  if (!value) return false;
  const v = value.toLowerCase().trim();
  return v === 'true' || v === '1' || v === 'yes' || v === 'on';
}
