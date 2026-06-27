'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { FANDOMS as STATIC_FANDOMS, type Fandom } from '@/app/(landing)/lib/fandoms';

type ApiFandom = { name: string; slug: string; image?: string; description?: string };

/** Fandom tiles for landing/marketing — API categories with static SVG fallback. */
export function useCatalogFandoms(): { fandoms: Fandom[]; loading: boolean } {
  const [fandoms, setFandoms] = useState<Fandom[]>(STATIC_FANDOMS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.getFandoms();
        const list = res?.data as ApiFandom[] | undefined;
        if (!Array.isArray(list) || list.length === 0 || cancelled) return;
        const staticByName = new Map(STATIC_FANDOMS.map((f) => [f.n.toLowerCase(), f.logo]));
        setFandoms(
          list.map((f) => ({
            n: f.name,
            logo:
              f.image ||
              staticByName.get(f.name.toLowerCase()) ||
              STATIC_FANDOMS[STATIC_FANDOMS.length - 1].logo,
          })),
        );
      } catch {
        // keep static list
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { fandoms, loading };
}
