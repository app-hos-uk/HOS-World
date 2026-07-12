import { UNIVERSES, type Universe } from './universes';
import { FANDOMS, type Fandom } from './fandoms';

export type ApiUniverse = {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
  tag?: string | null;
  description?: string | null;
  accentColor?: string | null;
  gradientColors?: string[];
  order?: number;
  featured?: boolean;
  isActive?: boolean;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

export function mapApiToUniverse(row: ApiUniverse): Universe {
  const cols =
    Array.isArray(row.gradientColors) && row.gradientColors.length >= 2
      ? row.gradientColors
      : ['#05050D', '#0C0C18', '#12122A', '#18183C', '#20204A'];

  return {
    n: row.name,
    logo: row.logo || '/landing/fandom/other.svg',
    tag: row.tag || '',
    d: row.description || '',
    cols,
    ac: row.accentColor || '#C9A84C',
    featured: row.featured,
  };
}

export function mapApiToFandom(row: ApiUniverse): Fandom {
  return {
    n: row.name,
    logo: row.logo || '/landing/fandom/other.svg',
  };
}

export async function fetchUniverses(): Promise<Universe[]> {
  if (!API_BASE_URL) return UNIVERSES;

  try {
    const res = await fetch(`${API_BASE_URL}/universes`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return UNIVERSES;

    const json = await res.json();
    const rows = json?.data as ApiUniverse[] | undefined;
    if (!Array.isArray(rows) || rows.length === 0) return UNIVERSES;

    return rows.map(mapApiToUniverse);
  } catch {
    return UNIVERSES;
  }
}

export async function fetchFandomsFromUniverses(): Promise<Fandom[]> {
  if (!API_BASE_URL) return FANDOMS;

  try {
    const res = await fetch(`${API_BASE_URL}/universes`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return FANDOMS;

    const json = await res.json();
    const rows = json?.data as ApiUniverse[] | undefined;
    if (!Array.isArray(rows) || rows.length === 0) return FANDOMS;

    return rows.map(mapApiToFandom);
  } catch {
    return FANDOMS;
  }
}
