'use client';

import { useEffect, useState, useCallback, Suspense, useRef, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { apiClient } from '@/lib/api';
import { useCurrency } from '@/contexts/CurrencyContext';
import Link from 'next/link';
import { ProductCard } from '@/components/ProductCard';
import { expandDepartmentCategories } from '@/lib/storefrontNavigation';

const ITEMS_PER_PAGE = 20;

const SORT_OPTIONS = [
  { value: '', label: 'Relevance' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'newest', label: 'Newest' },
  { value: 'popular', label: 'Top Rated' },
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
    categories: expandDepartmentCategories(params.getAll('category')),
    fandoms: params.getAll('fandom'),
    minPrice: params.get('minPrice') || '',
    maxPrice: params.get('maxPrice') || '',
    rating: Number(params.get('rating')) || 0,
    inStock: params.get('inStock') === 'true',
    sort: params.get('sortBy') || params.get('sort') || '',
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
  if (state.sort) params.set('sortBy', state.sort);
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
          aria-pressed={interactive ? star <= rating : undefined}
        >
          <svg
            className={`w-5 h-5 ${star <= rating ? 'text-yellow-400' : 'text-hos-text-muted'}`}
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
    <span className="inline-flex items-center gap-1 px-3 py-1 bg-hos-gold/20 text-hos-gold rounded-full text-sm">
      {label}
      <button
        onClick={onRemove}
        className="ml-0.5 hover:text-hos-gold transition-colors"
        aria-label={`Remove ${label} filter`}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </span>
  );
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
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState({ min: '', max: '' });
  const priceDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [state, setState] = useState<SearchState>(() => parseSearchParams(searchParams));

  const filterDepsKey = useMemo(
    () =>
      JSON.stringify({
        query: state.query,
        categories: state.categories,
        fandoms: state.fandoms,
        minPrice: state.minPrice,
        maxPrice: state.maxPrice,
        rating: state.rating,
        inStock: state.inStock,
        sort: state.sort,
      }),
    [
      state.query,
      state.categories,
      state.fandoms,
      state.minPrice,
      state.maxPrice,
      state.rating,
      state.inStock,
      state.sort,
    ],
  );
  const prevFilterDepsKeyRef = useRef('');

  useEffect(() => {
    setPriceDraft({ min: state.minPrice, max: state.maxPrice });
  }, [state.minPrice, state.maxPrice]);

  // Sync state from URL when searchParams change (browser back/forward)
  useEffect(() => {
    setState(parseSearchParams(searchParams));
  }, [searchParams]);

  const updateState = useCallback((updatesOrFn: Partial<SearchState> | ((prev: SearchState) => Partial<SearchState>)) => {
    setState(prev => {
      const updates = typeof updatesOrFn === 'function' ? updatesOrFn(prev) : updatesOrFn;
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
      setFetchError(null);
      try {
        const filters: Record<string, any> = {
          page: state.page,
          limit: ITEMS_PER_PAGE,
        };
        if (state.categories.length) filters.categories = state.categories;
        if (state.fandoms.length) filters.fandoms = state.fandoms;
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
          const total = Number(data.total) || 0;
          setTotalHits(total);
          const fromTotal = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));
          const fromApi = Number(data.totalPages);
          setTotalPages(
            Number.isFinite(fromApi) && fromApi > 0 ? Math.max(fromApi, fromTotal) : fromTotal,
          );
          setProcessingTimeMs(data.processingTimeMs || 0);
          const filtersChanged = prevFilterDepsKeyRef.current !== filterDepsKey;
          if (data.facets && filtersChanged) {
            setFacets(data.facets);
          }
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
            const fbTotal = Number(d.total) || 0;
            setTotalHits(fbTotal);
            const fbPages = Math.max(1, Math.ceil(fbTotal / ITEMS_PER_PAGE));
            const fbApi = Number(d.totalPages);
            setTotalPages(
              Number.isFinite(fbApi) && fbApi > 0 ? Math.max(fbApi, fbPages) : fbPages,
            );
            setProcessingTimeMs(0);
          }
        } catch (fallbackErr) {
          if (!cancelled) {
            console.error('Fallback also failed:', fallbackErr);
            setProducts([]);
            setFetchError('Unable to load products. Please try again.');
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchProducts();
    prevFilterDepsKeyRef.current = filterDepsKey;
    return () => { cancelled = true; };
  }, [state.page, filterDepsKey, state.query]);

  const toggleArrayFilter = (key: 'categories' | 'fandoms', value: string) => {
    updateState(prev => {
      const current = prev[key];
      const next = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      return { [key]: next };
    });
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
      if (state.page <= 3) {
        start = 2;
        end = 5;
      }
      if (state.page >= totalPages - 2) {
        start = totalPages - 4;
        end = totalPages - 1;
      }
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
          <span className="text-sm font-medium text-hos-text-secondary">
            Filters
            <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 bg-hos-gold text-[#1a1406] text-xs rounded-full">
              {activeFilterCount}
            </span>
          </span>
          <button
            onClick={clearAllFilters}
            className="text-sm text-hos-gold hover:text-hos-gold-hover font-medium"
          >
            Clear All
          </button>
        </div>
      )}

      {/* Category filter */}
      <div>
        <h3 className="text-sm font-semibold text-hos-text-secondary mb-2">Category</h3>
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {facets.category && Object.entries(facets.category).length > 0 ? (
            Object.entries(facets.category)
              .sort(([, a], [, b]) => b - a)
              .map(([name, count]) => (
                <label key={name} className="flex items-center gap-2 cursor-pointer text-sm text-hos-text-secondary hover:text-hos-gold">
                  <input
                    type="checkbox"
                    checked={state.categories.includes(name)}
                    onChange={() => toggleArrayFilter('categories', name)}
                    className="rounded border-hos-border text-hos-gold focus:ring-hos-gold/50"
                  />
                  <span className="flex-1 truncate">{name}</span>
                  <span className="text-xs text-hos-text-muted">({count})</span>
                </label>
              ))
          ) : (
            <p className="text-xs text-hos-text-muted italic">No categories available</p>
          )}
        </div>
      </div>

      {/* Fandom filter */}
      <div>
        <h3 className="text-sm font-semibold text-hos-text-secondary mb-2">Fandom</h3>
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {facets.fandom && Object.entries(facets.fandom).length > 0 ? (
            Object.entries(facets.fandom)
              .sort(([, a], [, b]) => b - a)
              .map(([name, count]) => (
                <label key={name} className="flex items-center gap-2 cursor-pointer text-sm text-hos-text-secondary hover:text-hos-gold">
                  <input
                    type="checkbox"
                    checked={state.fandoms.includes(name)}
                    onChange={() => toggleArrayFilter('fandoms', name)}
                    className="rounded border-hos-border text-hos-gold focus:ring-hos-gold/50"
                  />
                  <span className="flex-1 truncate">{name}</span>
                  <span className="text-xs text-hos-text-muted">({count})</span>
                </label>
              ))
          ) : (
            <p className="text-xs text-hos-text-muted italic">No fandoms available</p>
          )}
        </div>
      </div>

      {/* Price range */}
      <div>
        <h3 className="text-sm font-semibold text-hos-text-secondary mb-2">Price Range</h3>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="min-price">Minimum price</label>
          <input
            id="min-price"
            type="number"
            placeholder="Min"
            min={0}
            value={priceDraft.min}
            onChange={(e) => {
              const min = e.target.value;
              setPriceDraft((prev) => ({ ...prev, min }));
              if (priceDebounceRef.current) clearTimeout(priceDebounceRef.current);
              priceDebounceRef.current = setTimeout(() => {
                updateState({ minPrice: min });
              }, 400);
            }}
            className="w-full px-3 py-1.5 border border-hos-border rounded-md text-sm bg-hos-bg-secondary text-hos-text-secondary focus:ring-hos-gold/50 focus:border-hos-gold"
          />
          <span className="text-hos-text-muted">-</span>
          <label className="sr-only" htmlFor="max-price">Maximum price</label>
          <input
            id="max-price"
            type="number"
            placeholder="Max"
            min={0}
            value={priceDraft.max}
            onChange={(e) => {
              const max = e.target.value;
              setPriceDraft((prev) => ({ ...prev, max }));
              if (priceDebounceRef.current) clearTimeout(priceDebounceRef.current);
              priceDebounceRef.current = setTimeout(() => {
                updateState({ maxPrice: max });
              }, 400);
            }}
            className="w-full px-3 py-1.5 border border-hos-border rounded-md text-sm bg-hos-bg-secondary text-hos-text-secondary focus:ring-hos-gold/50 focus:border-hos-gold"
          />
        </div>
      </div>

      {/* Rating filter */}
      <div>
        <h3 className="text-sm font-semibold text-hos-text-secondary mb-2">Minimum Rating</h3>
        <StarRating
          rating={state.rating}
          interactive
          onClick={(star) => updateState({ rating: state.rating === star ? 0 : star })}
        />
        {state.rating > 0 && (
          <p className="text-xs text-hos-text-muted mt-1">{state.rating}+ stars</p>
        )}
      </div>

      {/* In-stock toggle */}
      <div>
        <label className="flex items-center gap-2 cursor-pointer text-sm text-hos-text-secondary">
          <input
            type="checkbox"
            checked={state.inStock}
            onChange={(e) => updateState({ inStock: e.target.checked })}
            className="rounded border-hos-border text-hos-gold focus:ring-hos-gold/50"
          />
          In Stock Only
        </label>
      </div>
    </div>
  );

  const showInitialSkeleton = loading && products.length === 0;

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
    <div className="min-h-screen bg-hos-bg-secondary">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-hos-text-secondary">
            {state.query ? `Search results for "${state.query}"` : 'All Products'}
          </h1>
          <p className="text-hos-text-secondary mt-1">
            Browse our collection of magical items from your favorite fandoms
          </p>
        </div>

        <div className="flex gap-8">
          {/* Desktop sidebar */}
          <aside className="hidden lg:block w-64 shrink-0">
            <div className="sticky top-24 bg-hos-bg-secondary rounded-xl shadow-sm border border-hos-border p-5">
              <FilterPanel />
            </div>
          </aside>

          {/* Mobile filter toggle */}
          <div className="lg:hidden fixed bottom-4 right-4 z-40">
            <button
              onClick={() => setMobileFiltersOpen(true)}
              className="flex items-center gap-2 bg-hos-gold text-[#1a1406] px-4 py-3 rounded-full shadow-lg hover:bg-hos-gold-hover transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filters
              {activeFilterCount > 0 && (
                <span className="bg-hos-bg-secondary text-hos-gold text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Mobile filter panel overlay */}
          {mobileFiltersOpen && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <div className="absolute inset-0 bg-black/40" onClick={() => setMobileFiltersOpen(false)} />
              <div className="absolute right-0 top-0 bottom-0 w-80 max-w-full bg-hos-bg-secondary shadow-xl p-6 overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold">Filters</h2>
                  <button
                    onClick={() => setMobileFiltersOpen(false)}
                    className="p-1 hover:bg-hos-bg-tertiary rounded-full"
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
            {fetchError && (
              <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 text-red-300 rounded-lg text-sm" role="alert">
                {fetchError}
              </div>
            )}
            {/* Toolbar: sort, result count */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3 text-sm text-hos-text-secondary">
                {(!loading || products.length > 0) && totalHits > 0 ? (
                  <span>
                    Showing {startIndex}-{endIndex} of {totalHits.toLocaleString()} results
                    {state.sort && (
                      <span className="text-hos-text-muted ml-2">
                        · Sorted by {SORT_OPTIONS.find(o => o.value === state.sort)?.label || state.sort}
                      </span>
                    )}
                  </span>
                ) : null}
              </div>
              <label className="flex items-center gap-2 text-sm text-hos-text-secondary">
                <span className="sr-only sm:not-sr-only sm:inline">Sort by</span>
                <select
                  value={state.sort}
                  onChange={(e) => updateState({ sort: e.target.value })}
                  aria-label="Sort products"
                  className="px-3 py-2 border border-hos-border rounded-lg text-sm bg-hos-bg-secondary text-hos-text-secondary focus:ring-hos-gold/50 focus:border-hos-gold"
                >
                  {SORT_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
            </div>

            {/* Active filter chips */}
            {activeFilterCount > 0 && (
              <div className="mb-4">{activeFilterChips}</div>
            )}

            {/* Product grid */}
            {showInitialSkeleton ? (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="bg-hos-bg-secondary rounded-lg border border-hos-border overflow-hidden animate-pulse">
                    <div className="aspect-square bg-hos-bg-tertiary" />
                    <div className="p-4 space-y-2">
                      <div className="h-4 bg-hos-bg-tertiary rounded w-3/4" />
                      <div className="h-4 bg-hos-bg-tertiary rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-16">
                <svg className="w-16 h-16 text-hos-text-muted mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <h3 className="text-lg font-medium text-hos-text-secondary mb-1">No products found</h3>
                <p className="text-hos-text-muted mb-4">Try adjusting your filters or search query</p>
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="text-hos-gold hover:text-hos-gold-hover font-medium text-sm"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="relative">
                  {loading && products.length > 0 && (
                    <div
                      className="absolute inset-0 z-[5] rounded-lg bg-hos-bg-secondary/50 flex justify-center pt-14 min-h-[200px]"
                      aria-busy="true"
                      aria-label="Loading products"
                    >
                      <div className="h-11 w-11 animate-spin rounded-full border-2 border-hos-border-accent border-t-hos-gold shrink-0" />
                    </div>
                  )}
                  <div
                    className={`grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 ${loading && products.length > 0 ? 'opacity-60 pointer-events-none' : ''}`}
                  >
                  {products.map((product) => (
                    <ProductCard
                      key={product.id}
                      id={product.id}
                      name={product.name}
                      price={Number(product.price)}
                      rrp={product.rrp ? Number(product.rrp) : undefined}
                      images={product.images}
                      averageRating={product.averageRating}
                      vendor={product.vendor?.businessName || product.vendorName}
                      fandom={product.fandom}
                    />
                  ))}
                  </div>
                </div>

                {/* Pagination */}
                {(totalPages > 1 || state.page > 1) && totalHits > 0 && (
                  <nav className="mt-8 flex items-center justify-center gap-1" aria-label="Pagination">
                    <button
                      type="button"
                      onClick={() => updateState({ page: state.page - 1 })}
                      disabled={state.page === 1}
                      className="px-3 py-2 text-sm border border-hos-border rounded-lg hover:bg-hos-bg-tertiary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </button>
                    {pageNumbers.map((p, i) =>
                      p < 0 ? (
                        <span key={`ellipsis-${i}`} className="px-2 py-2 text-hos-text-muted">...</span>
                      ) : (
                        <button
                          key={p}
                          type="button"
                          onClick={() => updateState({ page: p })}
                          className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                            p === state.page
                              ? 'bg-hos-gold text-[#1a1406] font-medium'
                              : 'border border-hos-border hover:bg-hos-bg-tertiary'
                          }`}
                        >
                          {p}
                        </button>
                      )
                    )}
                    <button
                      type="button"
                      onClick={() => updateState({ page: state.page + 1 })}
                      disabled={state.page === totalPages}
                      className="px-3 py-2 text-sm border border-hos-border rounded-lg hover:bg-hos-bg-tertiary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
      <div className="min-h-screen bg-hos-bg-secondary">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-hos-gold mx-auto mb-4" />
              <p className="text-hos-text-secondary">Loading products...</p>
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
