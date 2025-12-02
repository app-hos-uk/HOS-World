'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@hos-marketplace/theme-system';

export function SearchBar() {
  const [query, setQuery] = useState('');
  const router = useRouter();
  const theme = useTheme();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products, fandoms, sellers..."
          className="w-full px-4 py-3 pl-10 pr-4 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent"
          style={{
            backgroundColor: theme.colors.surface,
            color: theme.colors.text.primary,
            borderColor: theme.colors.secondary,
          }}
        />
        <button
          type="submit"
          className="absolute right-2 top-1/2 transform -translate-y-1/2 px-4 py-2 rounded-md"
          style={{
            backgroundColor: theme.colors.accent,
            color: '#ffffff',
          }}
        >
          Search
        </button>
      </div>
    </form>
  );
}


