import { getDirectApiBaseUrl } from '@/lib/apiBaseUrl';

export interface PublicShippingRule {
  id: string;
  name: string;
  rate: number;
  minimumCharge?: number | null;
  freeShippingThreshold?: number | null;
  estimatedDays?: number | null;
  isActive: boolean;
  conditions?: {
    country?: string;
    state?: string;
    city?: string;
    postalCode?: string;
  };
}

export interface PublicShippingMethod {
  id: string;
  name: string;
  description?: string | null;
  type: string;
  isActive: boolean;
  rules?: PublicShippingRule[];
}

/**
 * Server-side fetch for the public shipping info page.
 * Not cached: an upstream error or empty catalog must not pin "no methods" for 5 minutes.
 */
export async function fetchServerShippingMethods(): Promise<PublicShippingMethod[]> {
  try {
    const base = getDirectApiBaseUrl();
    const res = await fetch(`${base}/shipping/methods`, { cache: 'no-store' });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: PublicShippingMethod[] };
    const methods = json?.data;
    return Array.isArray(methods) ? methods : [];
  } catch {
    return [];
  }
}
