export interface FandomWorldItem {
  id: string;
  type: 'news' | 'event';
  title: string;
  excerpt: string;
  imageUrl: string | null;
  videoUrl: string | null;
  videoType: string | null;
  mediaType: string;
  date: string;
  categories: string[];
  sourceName?: string;
  sourceLogoUrl?: string;
  externalUrl?: string;
  eventType?: string;
  location?: string;
  slug?: string;
  isHOSEvent?: boolean;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const MARKET_CODE = (process.env.NEXT_PUBLIC_MARKET_CODE || 'US').toUpperCase();

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function isFandomWorldItem(value: unknown): value is FandomWorldItem {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<FandomWorldItem>;
  return (
    typeof row.id === 'string' &&
    typeof row.title === 'string' &&
    (row.type === 'news' || row.type === 'event')
  );
}

function normalizeItem(row: FandomWorldItem): FandomWorldItem {
  return {
    ...row,
    excerpt: row.excerpt || '',
    imageUrl: row.imageUrl ?? null,
    videoUrl: row.videoUrl ?? null,
    videoType: row.videoType ?? null,
    mediaType: row.mediaType || '',
    date: row.date || '',
    categories: Array.isArray(row.categories) ? row.categories.filter((category) => typeof category === 'string') : [],
  };
}

export async function fetchFandomWorldFeed(limit = 6): Promise<FandomWorldItem[]> {
  if (!API_URL) return [];

  try {
    const params = new URLSearchParams({
      market: MARKET_CODE,
      limit: String(limit),
    });
    const base = API_URL.replace(/\/+$/, '');
    const prefix = base.endsWith('/api') ? base : `${base}/api`;
    const res = await fetch(`${prefix}/fandom-world/feed?${params.toString()}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];

    const json = await res.json();
    const payload = json?.data ?? json;
    const rows = Array.isArray(payload) ? payload : payload?.items;
    if (!Array.isArray(rows)) return [];

    return rows.filter(isFandomWorldItem).map(normalizeItem);
  } catch {
    return [];
  }
}

export function fandomCardKind(item: FandomWorldItem): 'news' | 'video' | 'event' {
  if (item.type === 'event') return 'event';
  const media = (item.mediaType || '').toLowerCase();
  if (media === 'video' || media === 'youtube') return 'video';
  if (!media && item.videoUrl) return 'video';
  return 'news';
}

export function isFandomRelease(item: FandomWorldItem): boolean {
  return item.type === 'event' && /premiere|movie|film|release/.test((item.eventType || '').toLowerCase());
}

export function isFandomConvention(item: FandomWorldItem): boolean {
  return item.type === 'event' && /convention|comic-?con|\bcon\b/.test((item.eventType || '').toLowerCase());
}

export function youtubeVideoId(videoUrl: string): string | null {
  try {
    const url = new URL(videoUrl);
    const host = url.hostname.replace(/^www\./, '');
    let id = '';

    if (host === 'youtu.be') {
      id = url.pathname.split('/').filter(Boolean)[0] || '';
    } else if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      if (url.pathname === '/watch') {
        id = url.searchParams.get('v') || '';
      } else {
        const parts = url.pathname.split('/').filter(Boolean);
        if (parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'live') {
          id = parts[1] || '';
        }
      }
    }

    id = id.split(/[^a-zA-Z0-9_-]/)[0] || '';
    return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function youtubeEmbedUrl(videoUrl: string): string | null {
  const id = youtubeVideoId(videoUrl);
  return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
}

export function youtubeThumbnail(videoUrl: string): string | null {
  const id = youtubeVideoId(videoUrl);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

export function formatFandomDate(value: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: DATE_ONLY.test(value.trim()) ? 'UTC' : undefined,
  }).format(date);
}

export function timeAgo(value: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const deltaSec = Math.round((Date.now() - date.getTime()) / 1000);
  if (deltaSec < 0) return formatFandomDate(value);
  if (deltaSec < 45) return 'Just now';

  const minutes = Math.round(deltaSec / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;

  return formatFandomDate(value);
}
