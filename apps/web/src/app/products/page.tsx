'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { apiClient } from '@/lib/api';
import { useCurrency } from '@/contexts/CurrencyContext';
import Link from 'next/link';
import { SafeImage } from '@/components/SafeImage';

const ITEMS_PER_PAGE = 20;

const SORT_OPTIONS = [
  { value: '', label: 'Relevance' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'newest', label: 'Newest' },
  { value: 'rating', label: 'Top Rated' },
  { value: 'name_asc', label: 'Name A-Z' },
  { value: 'name_desc', label: 'Name Z-A' },
] as const;

interface SearchState {
  query: string;
  categories: string[];
  fandoms: string[];
  minPrice: string;
  maxPrice: string;
  rating: number;
  inStock: boolean;
  sort: string;
  page: number;
}

function parseSearchParams(params: URLSearchParams): SearchState {
  return {
    query: params.get('q') || '',
    categories: params.getAll('category'),
    fandoms: params.getAll('fandom'),
    minPrice: params.get('minPrice') || '',
    maxPrice: params.get('maxPrice') || '',
    rating: Number(params.get('rating')) || 0,
    inStock: params.get('inStock') === 'true',
    sort: params.get('sort') || '',
    page: Number(params.get('page')) || 1,
  };
}

function buildSearchParams(state: SearchState): string {
  const params = new URLSearchParams();
  if (state.query) params.set('q', state.query);
  state.categories.forEach(c => params.append('category', c));
  state.fandoms.forEach(f => params.append('fandom', f));
  if (state.minPrice) params.set('minPrice', state.minPrice);
  if (state.maxPrice) params.set('maxPrice', state.maxPrice);
  if (state.rating > 0) params.set('rating', String(state.rating));
  if (state.inStock) params.set('inStock', 'true');
  if (state.sort) params.set('sort', state.sort);
  if (state.page > 1) params.set('page', String(state.page));
  return params.toString();
}

function StarRating({ rating, onClick, interactive = false }: {
  rating: number;
  onClick?: (star: number) => void;
  interactive?: boolean;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          disabled={!interactive}
          onClick={() => onClick?.(star)}
          className={`text-lg ${interactive ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'}`}
          aria-label={`${star} star${star > 1 ? 's' : ''}`}
        >
          <svg
            className={`w-5 h-5 ${star <= rating ? 'text-yellow-400' : 'text-gray-300'}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </button>
      ))}
    </div>
  );
}

function ActiveFilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
      {label}
      <button
        onClick={onRemove}
        className="ml-0.5 hover:text-purple-600 transition-colors"
        aria-label={`Remove ${label} filter`}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </span>
  );
}

function sanitizeHighlight(html: string): string {
  return html.replace(/<(?!\/?mark\b)[^>]*>/gi, '');
}

function ProductsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { formatPrice } = useCurrency();

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalHits, setTotalHits] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [processingTimeMs, setProcessingTimeMs] = useState(0);
  const [facets, setFacets] = useState<Record<string, Record<string, number>>>({});
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const [state, setState] = useState<SearchState>(() => parseSearchParams(searchParams));

  // Sync state from URL when searchParams change (browser back/forward)
  useEffect(() => {
    setState(parseSearchParams(searchParams));
  }, [searchParams]);

  const updateState = useCallback((updates: Partial<SearchState>) => {
    setState(prev => {
      const next = { ...prev, ...updates };
      // Reset to page 1 when any filter changes (except page itself)
      if (!('page' in updates)) {
        next.page = 1;
      }
      const qs = buildSearchParams(next);
      router.replace(`/products${qs ? `?${qs}` : ''}`, { scroll: false });
      return next;
    });
  }, [router]);

  const activeFilterCount =
    state.categories.length +
    state.fandoms.length +
    (state.minPrice ? 1 : 0) +
    (state.maxPrice ? 1 : 0) +
    (state.rating > 0 ? 1 : 0) +
    (state.inStock ? 1 : 0);

  const clearAllFilters = useCallback(() => {
    updateState({
      categories: [],
      fandoms: [],
      minPrice: '',
      maxPrice: '',
      rating: 0,
      inStock: false,
    });
  }, [updateState]);

  // Fetch products
  useEffect(() => {
    let cancelled = false;

    const fetchProducts = async () => {
      setLoading(true);
      try {
        const filters: Record<string, any> = {
          page: state.page,
          limit: ITEMS_PER_PAGE,
        };
        if (state.categories.length === 1) filters.category = state.categories[0];
        if (state.fandoms.length === 1) filters.fandom = state.fandoms[0];
        if (state.minPrice) filters.minPrice = Number(state.minPrice);
        if (state.maxPrice) filters.maxPrice = Number(state.maxPrice);
        if (state.rating > 0) filters.minRating = state.rating;
        if (state.inStock) filters.inStock = true;
        if (state.sort) filters.sort = state.sort;

        const response = await apiClient.searchProducts(state.query, filters);

        if (cancelled) return;

        if (response?.data) {
          const data = response.data as any;
          setProducts(data.products || []);
          setTotalHits(data.total || 0);
          setTotalPages(data.totalPages || 1);
          setProcessingTimeMs(data.processingTimeMs || 0);
          setFacets(data.facets || {});
        }
      } catch (err) {
        if (cancelled) return;
        console.error('Meilisearch failed, falling back to getProducts:', err);
        try {
          const fallback = await apiClient.getProducts({
            page: state.page,
            limit: ITEMS_PER_PAGE,
            query: state.query,
            category: state.categories[0],
            fandom: state.fandoms[0],
            sortBy: (state.sort || 'newest') as any,
          });
          if (cancelled) return;
          if (fallback?.data) {
            const d = fallback.data as any;
            setProducts(d.items || d.data || []);
            setTotalHits(d.total || 0);
            setTotalPages(d.totalPages || Math.ceil((d.total || 0) / ITEMS_PER_PAGE) || 1);
            setProcessingTimeMs(0);
            setFacets({});
          }
        } catch (fallbackErr) {
          if (!cancelled) {
            console.error('Fallback also failed:', fallbackErr);
            setProducts([]);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchProducts();
    return () => { cancelled = true; };
  }, [state]);

  const toggleArrayFilter = (key: 'categories' | 'fandoms', value: string) => {
    const current = state[key];
    const next = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    updateState({ [key]: next });
  };

  const startIndex = (state.page - 1) * ITEMS_PER_PAGE + 1;
  const endIndex = Math.min(state.page * ITEMS_PER_PAGE, totalHits);

  const pageNumbers = (() => {
    const pages: number[] = [];
    const maxVisible = 7;
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      let start = Math.max(2, state.page - 1);
      let end = Math.min(totalPages - 1, state.page + 1);
      if (state.page <= 3) { start = 2; end = 5; }
      if (state.page >= totalPages - 2) { start = totalPages - 4; end = totalPages - 1; }
      if (start > 2) pages.push(-1); // ellipsis
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < totalPages - 1) pages.push(-2); // ellipsis
      pages.push(totalPages);
    }
    return pages;
  })();

  const FilterPanel = () => (
    <div className="space-y-6">
      {/* Active filter count + clear */}
      {activeFilterCount > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">
            Filters
            <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 bg-purple-600 text-white text-xs rounded-full">
              {activeFilterCount}
            </span>
          </span>
          <button
            onClick={clearAllFilters}
            className="text-sm text-purple-600 hover:text-purple-800 font-medium"
          >
            Clear All
          </button>
        </div>
      )}

      {/* Category filter */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Category</h3>
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {facets.category && Object.entries(facets.category).length > 0 ? (
            Object.entries(facets.category)
              .sort(([, a], [, b]) => b - a)
              .map(([name, count]) => (
                <label key={name} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 hover:text-gray-900">
                  <input
                    type="checkbox"
                    checked={state.categories.includes(name)}
                    onChange={() => toggleArrayFilter('categories', name)}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="flex-1 truncate">{name}</span>
                  <span className="text-xs text-gray-400">({count})</span>
                </label>
              ))
          ) : (
            <p className="text-xs text-gray-400 italic">No categories available</p>
          )}
        </div>
      </div>

      {/* Fandom filter */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Fandom</h3>
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {facets.fandom && Object.entries(facets.fandom).length > 0 ? (
            Object.entries(facets.fandom)
              .sort(([, a], [, b]) => b - a)
              .map(([name, count]) => (
                <label key={name} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 hover:text-gray-900">
                  <input
                    type="checkbox"
                    checked={state.fandoms.includes(name)}
                    onChange={() => toggleArrayFilter('fandoms', name)}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="flex-1 truncate">{name}</span>
                  <span className="text-xs text-gray-400">({count})</span>
                </label>
              ))
          ) : (
            <p className="text-xs text-gray-400 italic">No fandoms available</p>
          )}
        </div>
      </div>

      {/* Price range */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Price Range</h3>
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder="Min"
            min={0}
            value={state.minPrice}
            onChange={(e) => updateState({ minPrice: e.target.value })}
            className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-purple-500 focus:border-purple-500"
          />
          <span className="text-gray-400">-</span>
          <input
            type="number"
            placeholder="Max"
            min={0}
            value={state.maxPrice}
            onChange={(e) => updateState({ maxPrice: e.target.value })}
            className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-purple-500 focus:border-purple-500"
          />
        </div>
      </div>

      {/* Rating filter */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Minimum Rating</h3>
        <StarRating
          rating={state.rating}
          interactive
          onClick={(star) => updateState({ rating: state.rating === star ? 0 : star })}
        />
        {state.rating > 0 && (
          <p className="text-xs text-gray-500 mt-1">{state.rating}+ stars</p>
        )}
      </div>

      {/* In-stock toggle */}
      <div>
        <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
          <input
            type="checkbox"
            checked={state.inStock}
            onChange={(e) => updateState({ inStock: e.target.checked })}
            className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
          />
          In Stock Only
        </label>
      </div>
    </div>
  );

  const activeFilterChips = (
    <div className="flex flex-wrap gap-2">
      {state.categories.map(c => (
        <ActiveFilterChip key={`cat-${c}`} label={`Category: ${c}`} onRemove={() => toggleArrayFilter('categories', c)} />
      ))}
      {state.fandoms.map(f => (
        <ActiveFilterChip key={`fan-${f}`} label={`Fandom: ${f}`} onRemove={() => toggleArrayFilter('fandoms', f)} />
      ))}
      {state.minPrice && (
        <ActiveFilterChip label={`Min: ${formatPrice(Number(state.minPrice))}`} onRemove={() => updateState({ minPrice: '' })} />
      )}
      {state.maxPrice && (
        <ActiveFilterChip label={`Max: ${formatPrice(Number(state.maxPrice))}`} onRemove={() => updateState({ maxPrice: '' })} />
      )}
      {state.rating > 0 && (
        <ActiveFilterChip label={`${state.rating}+ Stars`} onRemove={() => updateState({ rating: 0 })} />
      )}
      {state.inStock && (
        <ActiveFilterChip label="In Stock" onRemove={() => updateState({ inStock: false })} />
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            {state.query ? `Search results for "${state.query}"` : 'All Products'}
          </h1>
          <p className="text-gray-600 mt-1">
            Browse our collection of magical items from your favorite fandoms
          </p>
        </div>

        <div className="flex gap-8">
          {/* Desktop sidebar */}
          <aside className="hidden lg:block w-64 shrink-0">
            <div className="sticky top-24 bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <FilterPanel />
            </div>
          </aside>

          {/* Mobile filter toggle */}
          <div className="lg:hidden fixed bottom-4 right-4 z-40">
            <button
              onClick={() => setMobileFiltersOpen(true)}
              className="flex items-center gap-2 bg-purple-600 text-white px-4 py-3 rounded-full shadow-lg hover:bg-purple-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filters
              {activeFilterCount > 0 && (
                <span className="bg-white text-purple-600 text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Mobile filter panel overlay */}
          {mobileFiltersOpen && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <div className="absolute inset-0 bg-black/40" onClick={() => setMobileFiltersOpen(false)} />
              <div className="absolute right-0 top-0 bottom-0 w-80 max-w-full bg-white shadow-xl p-6 overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold">Filters</h2>
                  <button
                    onClick={() => setMobileFiltersOpen(false)}
                    className="p-1 hover:bg-gray-100 rounded-full"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <FilterPanel />
              </div>
            </div>
          )}

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Toolbar: sort, result count, search time */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3 text-sm text-gray-600">
                {!loading && totalHits > 0 && (
                  <span>
                    Showing {startIndex}-{endIndex} of {totalHits.toLocaleString()} results
                    {processingTimeMs > 0 && (
                      <span className="text-gray-400 ml-1">in {processingTimeMs}ms</span>
                    )}
                  </span>
                )}
              </div>
              <select
                value={state.sort}
                onChange={(e) => updateState({ sort: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-purple-500 focus:border-purple-500"
              >
                {SORT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Active filter chips */}
            {activeFilterCount > 0 && (
              <div className="mb-4">{activeFilterChips}</div>
            )}

            {/* Product grid */}
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-lg border border-gray-200 overflow-hidden animate-pulse">
                    <div className="aspect-square bg-gray-200" />
                    <div className="p-4 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4" />
                      <div className="h-4 bg-gray-200 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-16">
                <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 mb-1">No products found</h3>
                <p className="text-gray-500 mb-4">Try adjusting your filters or search query</p>
                {activeFilterCount > 0 && (
                  <button
                    onClick={clearAllFilters}
                    className="text-purple-600 hover:text-purple-800 font-medium text-sm"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                  {products.map((product) => {
                    const highlighted = product._formatted;
                    return (
                      <Link key={product.id} href={`/products/${product.id}`} className="group">
                        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg hover:border-purple-200 transition-all duration-200">
                          <div className="aspect-square bg-gray-100 relative overflow-hidden">
                            {product.images && product.images[0] ? (
                              <SafeImage
                                src={product.images[0].url}
                                alt={product.name}
                                fill
                                sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                                className="object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400">
                                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                            )}
                            {product.stock !== undefined && product.stock <= 0 && (
                              <div className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                                Out of Stock
                              </div>
                            )}
                          </div>
                          <div className="p-3 sm:p-4">
                            <h3
                              className="font-semibold text-gray-900 group-hover:text-purple-600 transition-colors text-sm sm:text-base line-clamp-2"
                              dangerouslySetInnerHTML={{
                                __html: sanitizeHighlight(highlighted?.name || product.name),
                              }}
                            />
                            <div className="mt-2 flex items-center justify-between gap-2">
                              <span className="text-base sm:text-lg font-bold text-purple-900">
                                {formatPrice(Number(product.price))}
                              </span>
                              {product.averageRating > 0 && (
                                <div className="flex items-center gap-1 text-xs text-gray-500">
                                  <svg className="w-3.5 h-3.5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                  </svg>
                                  {Number(product.averageRating).toFixed(1)}
                                </div>
                              )}
                            </div>
                            {product.fandom && (
                              <p className="text-xs text-gray-500 mt-1 truncate">{product.fandom}</p>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <nav className="mt-8 flex items-center justify-center gap-1" aria-label="Pagination">
                    <button
                      onClick={() => updateState({ page: state.page - 1 })}
                      disabled={state.page === 1}
                      className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </button>
                    {pageNumbers.map((p, i) =>
                      p < 0 ? (
                        <span key={`ellipsis-${i}`} className="px-2 py-2 text-gray-400">...</span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => updateState({ page: p })}
                          className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                            p === state.page
                              ? 'bg-purple-600 text-white font-medium'
                              : 'border border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {p}
                        </button>
                      )
                    )}
                    <button
                      onClick={() => updateState({ page: state.page + 1 })}
                      disabled={state.page === totalPages}
                      className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </nav>
                )}
              </>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4" />
              <p className="text-gray-600">Loading products...</p>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    }>
      <ProductsContent />
    </Suspense>
  );
}
