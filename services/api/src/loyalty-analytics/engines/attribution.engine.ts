export function computeRoi(
  pointsAwarded: number,
  revenueInfluenced: number,
  pointRedemptionValue: number,
): number {
  const cost = pointsAwarded * pointRedemptionValue;
  if (cost <= 0) return 0;
  return Math.round(((revenueInfluenced - cost) / cost) * 10000) / 10000;
}
