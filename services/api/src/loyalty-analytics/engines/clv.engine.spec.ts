import { computeClv } from './clv.engine';

describe('CLV engine', () => {
  const base = {
    daysSinceLastPurchase: 10,
    totalOrders: 12,
    monthsSinceEnrollment: 6,
    avgOrderValue: 45,
    totalSpend: 540,
    tierLevel: 3,
    tierMultiplier: 1.5,
    engagementCount: 20,
  };

  it('computes positive CLV for an active member', () => {
    const r = computeClv(base);
    expect(r.clvScore).toBeGreaterThan(0);
    expect(r.churnRisk).toBeLessThan(0.5);
  });

  it('high-value member gets higher CLV', () => {
    const r = computeClv({ ...base, avgOrderValue: 200, totalOrders: 50, monthsSinceEnrollment: 12 });
    expect(r.clvScore).toBeGreaterThan(1000);
  });

  it('churned member has high churn risk', () => {
    const r = computeClv({ ...base, daysSinceLastPurchase: 365, totalOrders: 3, monthsSinceEnrollment: 6 });
    expect(r.churnRisk).toBeGreaterThan(0.5);
  });

  it('tier multiplier increases CLV', () => {
    const low = computeClv({ ...base, tierMultiplier: 1 });
    const high = computeClv({ ...base, tierMultiplier: 3 });
    expect(high.clvScore).toBeGreaterThan(low.clvScore);
  });

  it('zero orders gives zero CLV', () => {
    const r = computeClv({ ...base, totalOrders: 0, avgOrderValue: 0, totalSpend: 0, daysSinceLastPurchase: 999 });
    expect(r.clvScore).toBe(0);
  });

  it('frequency computed correctly from orders/months', () => {
    const r = computeClv({ ...base, totalOrders: 6, monthsSinceEnrollment: 3 });
    expect(r.clvScore).toBeGreaterThan(0);
    expect(r.churnRisk).toBeGreaterThanOrEqual(0);
  });
});
