import { normalizePhoneToE164 } from './phone-normalize';

describe('normalizePhoneToE164', () => {
  it('returns null for empty / invalid input', () => {
    expect(normalizePhoneToE164('')).toBeNull();
    expect(normalizePhoneToE164('   ')).toBeNull();
    expect(normalizePhoneToE164('abc')).toBeNull();
    expect(normalizePhoneToE164('123')).toBeNull();
  });

  it('preserves valid E.164 with + prefix and strips trunk 0 after country code', () => {
    expect(normalizePhoneToE164('+447700900123')).toBe('+447700900123');
    expect(normalizePhoneToE164('+1 (415) 555-2671')).toBe('+14155552671');
    expect(normalizePhoneToE164('00 44 7700 900123')).toBe('+447700900123');
    expect(normalizePhoneToE164('+44 (0)7700 900123')).toBe('+447700900123');
  });

  it('requires an explicit known country hint for national-format numbers', () => {
    expect(normalizePhoneToE164('07700900123')).toBeNull();
    expect(normalizePhoneToE164('4155552671')).toBeNull();
    expect(normalizePhoneToE164('07700900123', 'GB')).toBe('+447700900123');
    expect(normalizePhoneToE164('07700 900123', 'UK')).toBe('+447700900123');
  });

  it('normalises US / CA 10-digit numbers with known hints / aliases', () => {
    expect(normalizePhoneToE164('4155552671', 'US')).toBe('+14155552671');
    expect(normalizePhoneToE164('4155552671', 'USA')).toBe('+14155552671');
    expect(normalizePhoneToE164('4155552671', 'CA')).toBe('+14155552671');
    expect(normalizePhoneToE164('14155552671', 'US')).toBe('+14155552671');
  });

  it('normalises AE and AU local numbers', () => {
    expect(normalizePhoneToE164('0501234567', 'AE')).toBe('+971501234567');
    expect(normalizePhoneToE164('0412345678', 'AU')).toBe('+61412345678');
    expect(normalizePhoneToE164('0501234567', 'UAE')).toBe('+971501234567');
  });

  it('never invents E.164 for unrecognized country hints', () => {
    expect(normalizePhoneToE164('1701234567', 'DE')).toBeNull();
    expect(normalizePhoneToE164('612345678', 'FR')).toBeNull();
    expect(normalizePhoneToE164('4155552671', 'United States of Nowhere')).toBeNull();
  });

  it('rejects US numbers that are not 10/11 digits', () => {
    expect(normalizePhoneToE164('5552671', 'US')).toBeNull();
  });
});
