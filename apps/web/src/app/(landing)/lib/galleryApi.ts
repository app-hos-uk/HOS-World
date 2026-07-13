export type GalleryImage = {
  id: string;
  url: string;
  alt?: string | null;
  caption?: string | null;
  order: number;
};

export type GalleryAlbum = {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  eventDate?: string | null;
  location?: string | null;
  countryCode?: string | null;
  outletSlug?: string | null;
  uploadFolder?: string;
  coverUrl?: string | null;
  order: number;
  imageCount?: number;
  images?: GalleryImage[];
};

export type GalleryGroup = {
  key: string;
  label: string;
  albums: GalleryAlbum[];
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

export async function fetchGalleryAlbums(): Promise<GalleryAlbum[]> {
  if (!API_BASE_URL) return [];

  try {
    const res = await fetch(`${API_BASE_URL}/gallery/albums`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];

    const json = await res.json();
    const rows = json?.data as GalleryAlbum[] | undefined;
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

export async function fetchGalleryAlbum(slug: string): Promise<GalleryAlbum | null> {
  if (!API_BASE_URL) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/gallery/albums/${encodeURIComponent(slug)}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;

    const json = await res.json();
    return (json?.data as GalleryAlbum) || null;
  } catch {
    return null;
  }
}

export function formatGalleryDate(value?: string | null): string {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

function formatSegmentLabel(value: string): string {
  return value
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function groupGalleryAlbums(albums: GalleryAlbum[]): GalleryGroup[] {
  const hasRegions = albums.some((album) => album.countryCode || album.outletSlug);
  if (!hasRegions) {
    return [{ key: 'all', label: '', albums }];
  }

  const groups = new Map<string, GalleryAlbum[]>();

  for (const album of albums) {
    const country = album.countryCode?.trim().toLowerCase() || 'global';
    const outlet = album.outletSlug?.trim().toLowerCase() || 'general';
    const key = `${country}/${outlet}`;
    const existing = groups.get(key) ?? [];
    existing.push(album);
    groups.set(key, existing);
  }

  return [...groups.entries()].map(([key, groupAlbums]) => {
    const [country, outlet] = key.split('/');
    const countryLabel = country === 'global' ? 'Global' : country.toUpperCase();
    const outletLabel = formatSegmentLabel(outlet);
    const label =
      outlet === 'general' ? countryLabel : `${countryLabel} · ${outletLabel}`;

    return {
      key,
      label,
      albums: groupAlbums,
    };
  });
}
