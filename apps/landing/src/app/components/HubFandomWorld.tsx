'use client';

import { useRef, useState } from 'react';
import { FandomWorldCard } from './FandomWorldCard';
import { pickFandomTeaser, type FandomWorldItem } from '../lib/fandomWorldApi';

type Props = {
  initialItems: FandomWorldItem[];
  defaultShopHref: string;
};

const FILTERS = [
  { code: '', label: 'All' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'US', label: 'United States' },
  { code: 'MY', label: 'Malaysia' },
];

function fandomFeedUrl(market: string): string {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';
  const prefix = API_BASE.replace(/\/+$/, '').endsWith('/api')
    ? API_BASE.replace(/\/+$/, '')
    : `${API_BASE.replace(/\/+$/, '')}/api`;
  const params = new URLSearchParams({ limit: '12' });
  if (market) params.set('market', market);
  return `${prefix}/fandom-world/feed?${params.toString()}`;
}

function isFandomItem(value: unknown): value is FandomWorldItem {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<FandomWorldItem>;
  return typeof row.id === 'string' && typeof row.title === 'string' && (row.type === 'news' || row.type === 'event');
}

function readFeed(payload: unknown): FandomWorldItem[] {
  const body = payload && typeof payload === 'object' ? (payload as { data?: unknown }) : null;
  const data = body?.data ?? payload;
  const rows = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { items?: unknown }).items)
      ? (data as { items: unknown[] }).items
      : [];

  return rows.filter(isFandomItem).map((item) => ({
    ...item,
    excerpt: item.excerpt || '',
    imageUrl: item.imageUrl ?? null,
    videoUrl: item.videoUrl ?? null,
    videoType: item.videoType ?? null,
    mediaType: item.mediaType || '',
    date: item.date || '',
    categories: Array.isArray(item.categories) ? item.categories.filter((category) => typeof category === 'string') : [],
  }));
}

async function fetchMarketFeed(market: string): Promise<FandomWorldItem[]> {
  const res = await fetch(fandomFeedUrl(market));
  if (!res.ok) return [];
  return readFeed(await res.json());
}

export function HubFandomWorld({ initialItems, defaultShopHref }: Props) {
  const [active, setActive] = useState('');
  const [items, setItems] = useState(initialItems);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);
  const teaser = pickFandomTeaser(items, 6);
  const exploreHref = `${defaultShopHref.replace(/\/+$/, '')}/fandom-world`;

  async function selectFilter(code: string) {
    if (code === active) return;
    setActive(code);

    if (!code) {
      requestId.current += 1;
      setItems(initialItems);
      setLoading(false);
      return;
    }

    const id = ++requestId.current;
    setLoading(true);
    try {
      const next = await fetchMarketFeed(code);
      if (requestId.current !== id) return;
      setItems(next);
    } catch {
      if (requestId.current !== id) return;
      setItems([]);
    } finally {
      if (requestId.current === id) setLoading(false);
    }
  }

  return (
    <section className="hub-fandom" aria-labelledby="hub-fandom-heading">
      <div className="hub-fandom-inner">
        <div className="hub-fandom-header">
          <p className="eyebrow">Fandom World</p>
          <h2 id="hub-fandom-heading" className="sec-h2">
            Every Universe. Every Story.
          </h2>
          <p className="hub-fandom-desc">
            Premieres, gatherings, and stories from every chapter of the House. Filter by country, or take in the
            whole universe at once.
          </p>
        </div>

        <div className="hub-fandom-filters" role="tablist" aria-label="Filter Fandom World by country">
          {FILTERS.map((filter) => {
            const selected = active === filter.code;
            return (
              <button
                key={filter.label}
                type="button"
                role="tab"
                aria-selected={selected}
                className={`hub-fandom-filter${selected ? ' hub-fandom-filter--active' : ''}`}
                onClick={() => selectFilter(filter.code)}
              >
                {filter.label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="hub-fandom-loading" role="status" aria-live="polite">
            <span className="hub-sr">Loading Fandom World</span>
            <span className="hub-fandom-skeleton" />
            <span className="hub-fandom-skeleton" />
            <span className="hub-fandom-skeleton" />
          </div>
        ) : teaser.length > 0 ? (
          <div className="hub-fandom-grid">
            {teaser.map((item) => (
              <FandomWorldCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <p className="hub-fandom-empty">Stories from this chapter will appear here soon.</p>
        )}

        <div className="hub-fandom-cta">
          <a className="btn-p" href={exploreHref} target="_blank" rel="noopener noreferrer">
            Explore Fandom World
          </a>
        </div>
      </div>
    </section>
  );
}
