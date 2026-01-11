'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@hos-marketplace/theme-system';
import { apiClient } from '@/lib/api';
import { getPublicApiBaseUrl } from '@/lib/apiBaseUrl';

export function SearchBar() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const router = useRouter();
  const theme = useTheme();
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Close suggestions when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    // Cancel any in-flight fetch requests from previous queries
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Debounce search suggestions
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (query.trim().length >= 2) {
      debounceTimer.current = setTimeout(async () => {
        // Create a new AbortController for this fetch request
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        try {
          setLoadingSuggestions(true);
          const apiUrl = getPublicApiBaseUrl();
          if (!apiUrl) {
            console.error('NEXT_PUBLIC_API_URL environment variable is required in production');
            setLoadingSuggestions(false); // Reset loading state before early return
            return;
          }
          const response = await fetch(
            `${apiUrl}/search/suggestions?q=${encodeURIComponent(query.trim())}&limit=5`,
            { signal: abortController.signal }
          );
          
          // Check if request was aborted before processing response
          // If aborted, reset loading state and return early (don't update suggestions)
          if (abortController.signal.aborted) {
            setLoadingSuggestions(false);
            return;
          }

          if (response.ok) {
            const data = await response.json();
            // Only update suggestions if request wasn't aborted during processing
            if (!abortController.signal.aborted) {
              if (data.data && Array.isArray(data.data)) {
                setSuggestions(data.data);
                setShowSuggestions(true);
              } else {
                // Clear suggestions if response format is invalid
                setSuggestions([]);
                setShowSuggestions(false);
              }
            }
          } else {
            // Only update suggestions if request wasn't aborted
            if (!abortController.signal.aborted) {
              // Clear suggestions on API error to prevent stale data
              setSuggestions([]);
              setShowSuggestions(false);
              // Log error for debugging but don't show to user (non-critical feature)
              console.error('Search suggestions API error:', response.status, response.statusText);
            }
          }
        } catch (error: any) {
          // Ignore AbortError - it's expected when cancelling requests
          if (error.name === 'AbortError') {
            // Reset loading state even for aborted requests
            setLoadingSuggestions(false);
            return;
          }
          console.error('Error fetching suggestions:', error);
          // Only update suggestions if request wasn't aborted
          if (!abortController.signal.aborted) {
            // Clear suggestions on error to prevent stale data from being displayed
            setSuggestions([]);
            setShowSuggestions(false);
          }
        } finally {
          // Always reset loading state - the request is complete regardless of abort status
          // This ensures loading state is reset even if the request was aborted
          setLoadingSuggestions(false);
        }
      }, 300);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
      setLoadingSuggestions(false); // Reset loading state when query is too short
    }

    return () => {
      // Cancel debounce timer
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      // Cancel in-flight fetch request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [query]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setShowSuggestions(false);
      router.push(`/products?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    setShowSuggestions(false);
    router.push(`/products?q=${encodeURIComponent(suggestion)}`);
  };

  return (
    <div ref={searchRef} className="w-full max-w-2xl mx-auto relative">
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (suggestions.length > 0) {
                setShowSuggestions(true);
              }
            }}
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

      {/* Autocomplete Suggestions */}
      {showSuggestions && (suggestions.length > 0 || loadingSuggestions) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
          {loadingSuggestions ? (
            <div className="p-3 text-center text-gray-500 text-sm">Loading suggestions...</div>
          ) : (
            suggestions.map((suggestion, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleSuggestionClick(suggestion)}
                className="w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors text-sm"
              >
                {suggestion}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}


