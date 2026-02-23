'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@hos-marketplace/theme-system';
import { apiClient } from '@/lib/api';

const RECENT_SEARCHES_KEY = 'recent_searches';
const MAX_RECENT = 5;

function getRecentSearches(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string) {
  if (typeof window === 'undefined') return;
  try {
    const recent = getRecentSearches().filter(s => s !== query);
    recent.unshift(query);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
  } catch {
    // ignore
  }
}

function clearRecentSearches() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch {
    // ignore
  }
}

interface InstantProduct {
  id: string;
  name: string;
  slug?: string;
  price: number;
  currency?: string;
  image: string | null;
}

export function SearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<InstantProduct[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const router = useRouter();
  const theme = useTheme();
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const showingRecent = query.trim().length === 0 && recentSearches.length > 0;
  const showingResults = query.trim().length >= 2 && (results.length > 0 || loading);

  const totalItems = showingRecent
    ? recentSearches.length
    : results.length + (query.trim().length >= 2 ? 1 : 0); // +1 for "View all results"

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (query.trim().length >= 2) {
      setLoading(true);
      debounceTimer.current = setTimeout(async () => {
        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
          const response = await apiClient.getInstantSearch(query.trim(), 6);
          if (controller.signal.aborted) return;

          if (response?.data) {
            const data = response.data as any;
            setResults(data.products || []);
            setShowDropdown(true);
          } else {
            setResults([]);
          }
        } catch (error: any) {
          if (error?.name === 'AbortError') return;
          console.error('Instant search error:', error);
          if (!controller.signal.aborted) {
            setResults([]);
          }
        } finally {
          if (!controller.signal.aborted) {
            setLoading(false);
          }
        }
      }, 250);
    } else {
      setResults([]);
      setLoading(false);
    }

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [query]);

  const navigateToSearch = useCallback((term: string) => {
    if (!term.trim()) return;
    saveRecentSearch(term.trim());
    setShowDropdown(false);
    setQuery(term.trim());
    router.push(`/products?q=${encodeURIComponent(term.trim())}`);
  }, [router]);

  const navigateToProduct = useCallback((id: string) => {
    setShowDropdown(false);
    if (query.trim()) saveRecentSearch(query.trim());
    router.push(`/products/${id}`);
  }, [router, query]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigateToSearch(query);
  };

  const handleFocus = () => {
    const recent = getRecentSearches();
    setRecentSearches(recent);
    if (query.trim().length >= 2 && results.length > 0) {
      setShowDropdown(true);
    } else if (query.trim().length === 0 && recent.length > 0) {
      setShowDropdown(true);
    }
    setHighlightIndex(-1);
  };

  const handleClearRecent = () => {
    clearRecentSearches();
    setRecentSearches([]);
    setShowDropdown(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || totalItems === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex(prev => (prev + 1) % totalItems);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex(prev => (prev - 1 + totalItems) % totalItems);
    } else if (e.key === 'Enter' && highlightIndex >= 0) {
      e.preventDefault();
      if (showingRecent) {
        navigateToSearch(recentSearches[highlightIndex]);
      } else {
        if (highlightIndex < results.length) {
          navigateToProduct(results[highlightIndex].id);
        } else {
          navigateToSearch(query);
        }
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
      inputRef.current?.blur();
    }
  };

  const shouldShowDropdown = showDropdown && (showingRecent || showingResults);

  return (
    <div ref={searchRef} className="w-full max-w-2xl mx-auto relative">
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlightIndex(-1);
            }}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            placeholder="Search products, fandoms, sellers..."
            className="w-full px-3 sm:px-4 py-2 sm:py-3 pl-9 sm:pl-10 pr-20 sm:pr-24 text-sm sm:text-base rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent"
            style={{
              backgroundColor: theme.colors.surface,
              color: theme.colors.text.primary,
              borderColor: theme.colors.secondary,
            }}
            autoComplete="off"
            role="combobox"
            aria-label="Search products"
            aria-expanded={shouldShowDropdown}
            aria-haspopup="listbox"
            aria-controls={shouldShowDropdown ? 'search-results-listbox' : undefined}
            aria-activedescendant={highlightIndex >= 0 ? `search-option-${highlightIndex}` : undefined}
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

      {shouldShowDropdown && (
        <div
          id="search-results-listbox"
          className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden"
          role="listbox"
          aria-label="Search results"
        >
          {/* Recent searches */}
          {showingRecent && (
            <>
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Recent Searches</span>
                <button
                  onClick={handleClearRecent}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Clear
                </button>
              </div>
              {recentSearches.map((term, index) => (
                <button
                  key={term}
                  type="button"
                  id={`search-option-${index}`}
                  onClick={() => navigateToSearch(term)}
                  className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${
                    highlightIndex === index ? 'bg-purple-50' : 'hover:bg-gray-50'
                  }`}
                  role="option"
                  aria-selected={highlightIndex === index}
                >
                  <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-gray-700 truncate">{term}</span>
                </button>
              ))}
            </>
          )}

          {/* Loading state */}
          {loading && query.trim().length >= 2 && results.length === 0 && (
            <div className="p-4 text-center">
              <div className="inline-flex items-center gap-2 text-sm text-gray-500">
                <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                Searching...
              </div>
            </div>
          )}

          {/* Product results */}
          {!showingRecent && results.length > 0 && (
            <>
              {results.map((product, index) => (
                <button
                  key={product.id}
                  type="button"
                  id={`search-option-${index}`}
                  onClick={() => navigateToProduct(product.id)}
                  className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${
                    highlightIndex === index ? 'bg-purple-50' : 'hover:bg-gray-50'
                  }`}
                  role="option"
                  aria-selected={highlightIndex === index}
                >
                  <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden shrink-0 relative">
                    {product.image ? (
                      /* eslint-disable @next/next/no-img-element */
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                    <p className="text-sm text-purple-700 font-semibold">
                      {product.currency === 'USD' ? '$' : '£'}{Number(product.price).toFixed(2)}
                    </p>
                  </div>
                  <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}

              {/* View all results link */}
              <button
                type="button"
                id={`search-option-${results.length}`}
                onClick={() => navigateToSearch(query)}
                className={`w-full text-left px-4 py-3 border-t border-gray-100 flex items-center justify-center gap-2 transition-colors ${
                  highlightIndex === results.length ? 'bg-purple-50' : 'hover:bg-gray-50'
                }`}
                role="option"
                aria-selected={highlightIndex === results.length}
              >
                <span className="text-sm font-medium text-purple-600">
                  View all results for &ldquo;{query}&rdquo;
                </span>
                <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </>
          )}

          {/* No results */}
          {!showingRecent && !loading && query.trim().length >= 2 && results.length === 0 && (
            <div className="p-4 text-center text-sm text-gray-500">
              No results found for &ldquo;{query}&rdquo;
            </div>
          )}
        </div>
      )}
    </div>
  );
}
