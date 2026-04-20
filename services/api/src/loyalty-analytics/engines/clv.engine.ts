export interface RfmInput {
  daysSinceLastPurchase: number;
  totalOrders: number;
  monthsSinceEnrollment: number;
  avgOrderValue: number;
  totalSpend: number;
  tierLevel: number;
  tierMultiplier: number;
  engagementCount: number;
}

export function computeClv(input: RfmInput): { clvScore: number; churnRisk: number } {
  const {
    daysSinceLastPurchase,
    totalOrders,
    monthsSinceEnrollment,
    avgOrderValue,
    tierMultiplier,
    engagementCount,
  } = input;

  const months = Math.max(1, monthsSinceEnrollment);
  const frequency = totalOrders / months;
  const monetary = avgOrderValue;
  const recencyScore = Math.max(0, 1 - daysSinceLastPurchase / 365);
  const engagementBonus = 1 + Math.min(0.5, engagementCount * 0.01);
  const tierBonus = Math.max(1, tierMultiplier);

  const clvScore = Math.round(monetary * frequency * 12 * recencyScore * engagementBonus * tierBonus * 100) / 100;

  const expectedGap = 30 / Math.max(0.1, frequency);
  const churnRisk = Math.min(1, Math.max(0, (daysSinceLastPurchase - expectedGap) / (expectedGap * 2)));
  const roundedChurn = Math.round(churnRisk * 10000) / 10000;

  return { clvScore: Math.max(0, clvScore), churnRisk: roundedChurn };
}
