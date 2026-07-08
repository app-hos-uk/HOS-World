'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { FANDOMS as STATIC_FANDOMS, type Fandom } from '@/app/(landing)/lib/fandoms';

type ApiFandom = { name: string; slug: string; image?: string; description?: string };

/** Name aliases so API category names can enrich static marketing items. */
const NAME_ALIASES: Record<string, string[]> = {
  marvel: ['marvel', 'spider-man', 'spiderman', 'avengers'],
  'wizarding world': ['wizarding world', 'harry potter', 'hogwarts'],
  'middle earth': ['middle earth', 'lord of the rings', 'lotr', 'the hobbit'],
  'dc universe': ['dc universe', 'dc comics', 'superman', 'batman'],
  'sci-fi classics': ['sci-fi classics', 'star trek'],
  'fantasy epics': ['fantasy epics', 'dungeons & dragons'],
};

function findStaticMatch(apiName: string): string | null {
  const lower = apiName.toLowerCase();
  for (const [staticKey, aliases] of Object.entries(NAME_ALIASES)) {
    if (aliases.includes(lower)) return staticKey;
  }
  return null;
}

/**
 * Fandom tiles for landing/marketing — always returns the full static list
 * (18 universes). API data is used only to enrich logos where names match.
 */
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

        const apiLogoByKey = new Map<string, string>();
        for (const f of list) {
          if (!f.image) continue;
          if (!f.image.startsWith('/') && !f.image.startsWith('http')) continue;
          const lower = f.name.toLowerCase();
          apiLogoByKey.set(lower, f.image);
          const staticKey = findStaticMatch(f.name);
          // Only set alias if no direct match already exists for that key
          if (staticKey && !apiLogoByKey.has(staticKey)) {
            apiLogoByKey.set(staticKey, f.image);
          }
        }

        setFandoms(
          STATIC_FANDOMS.map((f) => ({
            ...f,
            logo: apiLogoByKey.get(f.n.toLowerCase()) || f.logo,
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
