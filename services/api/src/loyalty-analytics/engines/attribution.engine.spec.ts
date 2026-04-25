import { computeRoi } from './attribution.engine';

describe('Attribution engine', () => {
  it('positive ROI', () => {
    const roi = computeRoi(1000, 500, 0.01);
    expect(roi).toBeCloseTo((500 - 10) / 10, 2);
  });

  it('negative ROI when cost exceeds revenue', () => {
    const roi = computeRoi(100000, 100, 0.01);
    expect(roi).toBeLessThan(0);
  });

  it('zero cost returns 0', () => {
    expect(computeRoi(0, 500, 0.01)).toBe(0);
  });

  it('high volume', () => {
    const roi = computeRoi(50000, 100000, 0.01);
    expect(roi).toBeGreaterThan(0);
  });
});
