'use client';

import { useMemo, useState } from 'react';
import { FandomWorldCard } from './FandomWorldCard';
import {
  fandomCardKind,
  isFandomConvention,
  isFandomRelease,
  type FandomWorldItem,
} from '../lib/fandomWorldApi';

type Props = {
  items: FandomWorldItem[];
};

const TYPE_TABS = [
  { id: 'all', label: 'All' },
  { id: 'news', label: 'News' },
  { id: 'videos', label: 'Videos' },
  { id: 'events', label: 'Events' },
  { id: 'releases', label: 'Releases' },
  { id: 'conventions', label: 'Conventions' },
] as const;

type TypeFilter = (typeof TYPE_TABS)[number]['id'];

const BASE_CATEGORIES = [
  'Marvel',
  'Star Wars',
  'DC',
  'Anime',
  'Middle Earth',
  'Wizarding World',
  'Naruto',
  'Studio Ghibli',
  'Game of Thrones',
  'Disney',
];

const CATEGORY_ALIASES: Record<string, string[]> = {
  marvel: ['marvel'],
  'star wars': ['star wars'],
  dc: ['dc', 'dc universe'],
  anime: ['anime', 'manga', 'naruto', 'one piece', 'dragon ball', 'studio ghibli', 'ghibli'],
  'middle earth': ['middle earth', 'middle-earth', 'lotr', 'lord of the rings'],
  'wizarding world': ['wizarding', 'harry potter', 'hogwarts'],
  naruto: ['naruto'],
  'studio ghibli': ['studio ghibli', 'ghibli'],
  'game of thrones': ['game of thrones', 'westeros'],
  disney: ['disney'],
};

function categoryMatches(categories: string[], chip: string): boolean {
  const aliases = CATEGORY_ALIASES[chip.toLowerCase()] ?? [chip.toLowerCase()];
  return categories.some((category) => {
    const hay = category.toLowerCase();
    return aliases.some((alias) => hay === alias || hay.includes(alias));
  });
}

function matchesType(item: FandomWorldItem, filter: TypeFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'news') return fandomCardKind(item) === 'news';
  if (filter === 'videos') return fandomCardKind(item) === 'video';
  if (filter === 'events') return item.type === 'event';
  if (filter === 'releases') return isFandomRelease(item);
  return isFandomConvention(item);
}

export function FandomWorldBrowse({ items }: Props) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [category, setCategory] = useState<string | null>(null);

  const chips = useMemo(() => {
    const extras: string[] = [];
    const seen = new Set(BASE_CATEGORIES.map((chip) => chip.toLowerCase()));
    for (const item of items) {
      for (const entry of item.categories) {
        const label = entry.trim();
        const key = label.toLowerCase();
        if (!key || seen.has(key)) continue;
        if (BASE_CATEGORIES.some((chip) => categoryMatches([label], chip))) continue;
        seen.add(key);
        extras.push(label);
      }
    }
    return [...BASE_CATEGORIES, ...extras];
  }, [items]);

  const visible = useMemo(
    () =>
      items.filter((item) => {
        if (!matchesType(item, typeFilter)) return false;
        if (category && !categoryMatches(item.categories, category)) return false;
        return true;
      }),
    [items, typeFilter, category],
  );

  if (items.length === 0) {
    return (
      <section className="fw-section">
        <div className="fw-coming-soon rv">
          <p className="eyebrow">Coming Soon</p>
          <p className="sec-sub">
            Premieres, gatherings, and stories from across the fandom world will gather here.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="fw-section" aria-label="Fandom World stories">
      <div className="fw-filters" role="tablist" aria-label="Filter by type">
        {TYPE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={typeFilter === tab.id}
            className={`fw-filter-tab${typeFilter === tab.id ? ' fw-filter-tab--active' : ''}`}
            onClick={() => setTypeFilter(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="fw-category-chips" role="group" aria-label="Filter by universe">
        <button
          type="button"
          className={`fw-category-chip${!category ? ' fw-category-chip--active' : ''}`}
          onClick={() => setCategory(null)}
        >
          All
        </button>
        {chips.map((chip) => (
          <button
            key={chip}
            type="button"
            className={`fw-category-chip${category === chip ? ' fw-category-chip--active' : ''}`}
            onClick={() => setCategory((current) => (current === chip ? null : chip))}
          >
            {chip}
          </button>
        ))}
      </div>

      {visible.length > 0 ? (
        <div className="fw-grid">
          {visible.map((item) => (
            <FandomWorldCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <p className="fw-empty">Nothing in this universe yet.</p>
      )}
    </section>
  );
}
