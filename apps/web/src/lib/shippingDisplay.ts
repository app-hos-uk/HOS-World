import { formatAdminPrice } from '@/lib/adminFormat';
import type { PublicShippingMethod, PublicShippingRule } from '@/lib/fetchServerShippingMethods';

function formatDeliveryEstimate(days?: number | null): string | null {
  if (days == null || days <= 0) return null;
  if (days === 1) return '1 business day';
  return `${days} business days`;
}

function formatRuleRate(methodType: string, rule: PublicShippingRule): string {
  if (methodType === 'FREE_SHIPPING') return 'Free';

  if (methodType === 'WEIGHT_BASED') {
    const base = formatAdminPrice(rule.rate);
    const min =
      rule.minimumCharge != null && rule.minimumCharge > 0
        ? formatAdminPrice(rule.minimumCharge)
        : null;
    return min ? `${base}/kg (min ${min})` : `${base}/kg`;
  }

  // Checkout enforces minimumCharge as a floor for all non-free method types.
  const effectiveRate =
    rule.minimumCharge != null && rule.minimumCharge > rule.rate
      ? rule.minimumCharge
      : rule.rate;
  return formatAdminPrice(effectiveRate);
}

function formatRuleDestination(rule: PublicShippingRule): string | null {
  const country = rule.conditions?.country?.trim();
  if (!country) return null;
  return country.toUpperCase();
}

export function formatPublicShippingRuleLine(
  method: PublicShippingMethod,
  rule: PublicShippingRule,
): string {
  const parts: string[] = [];
  const destination = formatRuleDestination(rule);
  if (destination) parts.push(destination);
  const estimate = formatDeliveryEstimate(rule.estimatedDays);
  if (estimate) parts.push(estimate);
  parts.push(formatRuleRate(method.type, rule));
  return parts.join(' — ');
}

export function collectFreeShippingThresholds(methods: PublicShippingMethod[]): number[] {
  const thresholds = new Set<number>();
  for (const method of methods) {
    for (const rule of method.rules ?? []) {
      if (!rule.isActive) continue;
      if (rule.freeShippingThreshold != null && rule.freeShippingThreshold > 0) {
        thresholds.add(rule.freeShippingThreshold);
      }
    }
  }
  return [...thresholds].sort((a, b) => a - b);
}

export function getPrimaryRule(method: PublicShippingMethod): PublicShippingRule | undefined {
  return (method.rules ?? []).find((rule) => rule.isActive);
}
