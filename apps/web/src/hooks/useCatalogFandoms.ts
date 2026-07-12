'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { FANDOMS as STATIC_FANDOMS, type Fandom } from '@/app/(landing)/lib/fandoms';
import { mapApiToFandom, type ApiUniverse } from '@/app/(landing)/lib/universesApi';

/**
 * Fandom tiles for landing/marketing — fetches from /universes API
 * with static fallback when API is unavailable.
 */
export function useCatalogFandoms(): { fandoms: Fandom[]; loading: boolean } {
  const [fandoms, setFandoms] = useState<Fandom[]>(STATIC_FANDOMS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.getUniverses();
        const list = res?.data as ApiUniverse[] | undefined;
        if (!Array.isArray(list) || list.length === 0 || cancelled) return;

        setFandoms(list.map(mapApiToFandom));
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
