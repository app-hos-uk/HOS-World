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
          className="w-full px-3 sm:px-4 py-2 sm:py-3 pl-8 sm:pl-10 pr-20 sm:pr-24 text-sm sm:text-base rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent"
          style={{
            backgroundColor: theme.colors.surface,
            color: theme.colors.text.primary,
            borderColor: theme.colors.secondary,
          }}
        />
        <button
          type="submit"
          className="absolute right-1 sm:right-2 top-1/2 transform -translate-y-1/2 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-md font-medium transition-colors"
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


