import { fromMinorUnits, minorUnitExponent, toMinorUnits } from './money';

describe('money helpers', () => {
  describe('minorUnitExponent', () => {
    it('returns 2 for standard currencies', () => {
      expect(minorUnitExponent('USD')).toBe(2);
      expect(minorUnitExponent('GBP')).toBe(2);
      expect(minorUnitExponent('EUR')).toBe(2);
    });

    it('returns 0 for zero-decimal currencies', () => {
      expect(minorUnitExponent('JPY')).toBe(0);
      expect(minorUnitExponent('KRW')).toBe(0);
      expect(minorUnitExponent('VND')).toBe(0);
    });

    it('returns 3 for three-decimal currencies', () => {
      expect(minorUnitExponent('BHD')).toBe(3);
      expect(minorUnitExponent('KWD')).toBe(3);
      expect(minorUnitExponent('OMR')).toBe(3);
    });

    it('is case-insensitive', () => {
      expect(minorUnitExponent('jpy')).toBe(0);
      expect(minorUnitExponent('usd')).toBe(2);
      expect(minorUnitExponent('bhd')).toBe(3);
    });
  });

  describe('toMinorUnits / fromMinorUnits', () => {
    it('round-trips USD/GBP/EUR at 2 decimals', () => {
      for (const currency of ['USD', 'GBP', 'EUR']) {
        expect(toMinorUnits(19.99, currency)).toBe(1999);
        expect(fromMinorUnits(1999, currency)).toBe(19.99);
        expect(toMinorUnits(0.01, currency)).toBe(1);
        expect(toMinorUnits(100, currency)).toBe(10000);
      }
    });

    it('handles JPY as zero-decimal (1000 JPY → 1000, not 100000)', () => {
      expect(toMinorUnits(1000, 'JPY')).toBe(1000);
      expect(fromMinorUnits(1000, 'JPY')).toBe(1000);
      expect(toMinorUnits(1500, 'jpy')).toBe(1500);
    });

    it('handles BHD at 3 decimals', () => {
      expect(toMinorUnits(10.235, 'BHD')).toBe(10235);
      expect(fromMinorUnits(10235, 'BHD')).toBe(10.235);
      expect(toMinorUnits(1.001, 'bhd')).toBe(1001);
    });

    it('handles float-rounding edge cases', () => {
      // Classic IEEE754 trap: Math.round(1.005 * 100) === 100
      expect(toMinorUnits(1.005, 'USD')).toBe(101);
      expect(toMinorUnits(0.1 + 0.2, 'USD')).toBe(30);
      expect(toMinorUnits(19.99, 'USD')).toBe(1999);
      expect(toMinorUnits(2.675, 'USD')).toBe(268);
      // Three-decimal half-up: 1.0005 → 1.001 fils
      expect(toMinorUnits(1.0005, 'BHD')).toBe(1001);
    });

    it('rejects non-finite amounts', () => {
      expect(() => toMinorUnits(Number.NaN, 'USD')).toThrow(/finite/);
      expect(() => toMinorUnits(Number.POSITIVE_INFINITY, 'JPY')).toThrow(/finite/);
      expect(() => fromMinorUnits(Number.NaN, 'USD')).toThrow(/finite/);
    });

    it('accepts lowercase currency codes from Stripe', () => {
      expect(toMinorUnits(12.34, 'usd')).toBe(1234);
      expect(fromMinorUnits(1234, 'usd')).toBe(12.34);
      expect(fromMinorUnits(500, 'jpy')).toBe(500);
    });

    it('is stable under round-trip for currency-precision amounts', () => {
      const cases: Array<[number, string]> = [
        [19.99, 'USD'],
        [0.01, 'GBP'],
        [100, 'EUR'],
        [1000, 'JPY'],
        [0, 'KRW'],
        [10.235, 'BHD'],
        [1.5, 'USD'],
        [-19.99, 'USD'],
        [-1000, 'JPY'],
      ];
      for (const [amount, currency] of cases) {
        expect(fromMinorUnits(toMinorUnits(amount, currency), currency)).toBe(amount);
      }
    });
  });
});
