'use client';

import { useState } from 'react';
import { FandomCollection } from '@/components/FandomCollection';
import { StorefrontBreadcrumbs } from '@/components/storefront/StorefrontBreadcrumbs';

export function FandomsPageSearch() {
  const [query, setQuery] = useState('');

  const normalizedQuery = query.trim().toLowerCase();

  return (
    <>
      <StorefrontBreadcrumbs
        className="mb-4"
        items={[
          { label: 'Shop', href: '/shop' },
          { label: 'Fandoms' },
        ]}
      />
      <div className="mb-6 max-w-md">
        <label htmlFor="fandom-search" className="sr-only">
          Search fandoms
        </label>
        <input
          id="fandom-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search franchises…"
          className="w-full px-4 py-2.5 rounded-lg border border-hos-border bg-hos-bg-secondary text-hos-text-secondary placeholder:text-hos-text-muted focus:outline-none focus:ring-2 focus:ring-hos-gold-ring"
        />
      </div>
      <FandomCollection showAllPage={true} searchQuery={normalizedQuery || undefined} />
    </>
  );
}
