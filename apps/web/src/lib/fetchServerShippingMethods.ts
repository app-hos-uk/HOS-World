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

/** Server-side fetch for public shipping info page (cached 5 min). */
export async function fetchServerShippingMethods(): Promise<PublicShippingMethod[]> {
  try {
    const base = getDirectApiBaseUrl();
    const res = await fetch(`${base}/shipping/methods`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: PublicShippingMethod[] };
    return json?.data ?? [];
  } catch {
    return [];
  }
}
