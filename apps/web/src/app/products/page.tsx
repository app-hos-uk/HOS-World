'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { apiClient } from '@/lib/api';
import { ProductCard } from '@/components/ProductCard';

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState<{
    query: string;
    fandom: string;
    category: string;
    sortBy: 'newest' | 'relevance' | 'price_asc' | 'price_desc' | 'popular';
  }>({
    query: '',
    fandom: '',
    category: '',
    sortBy: 'newest',
  });

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.getProducts({
        page,
        limit: 20,
        ...filters,
      });
      if (response?.data) {
        setProducts((response.data as any).items || response.data.data || []);
        setTotalPages((response.data as any).totalPages || Math.ceil(((response.data as any).total || 0) / 20) || 1);
      }
    } catch (err: any) {
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleFilterChange = useCallback((key: keyof typeof filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const paginationControls = useMemo(() => {
    if (totalPages <= 1) return null;
    return (
      <div className="mt-8 flex justify-center gap-2">
        <button
          onClick={() => handlePageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="px-4 py-2 border rounded-lg disabled:opacity-50"
        >
          Previous
        </button>
        <span className="px-4 py-2">Page {page} of {totalPages}</span>
        <button
          onClick={() => handlePageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="px-4 py-2 border rounded-lg disabled:opacity-50"
        >
          Next
        </button>
      </div>
    );
  }, [page, totalPages, handlePageChange]);

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4 sm:mb-6 lg:mb-8">All Products</h1>
        <p className="text-base sm:text-lg text-gray-600 mb-6 sm:mb-8">
          Browse our collection of magical items from your favorite fandoms
        </p>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-4">
          <input
            type="text"
            placeholder="Search products..."
            value={filters.query}
            onChange={(e) => handleFilterChange('query', e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          />
          <select
            value={filters.sortBy}
            onChange={(e) => handleFilterChange('sortBy', e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="newest">Newest</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="popular">Popular</option>
          </select>
        </div>

        {loading ? (
          <div className="text-center text-gray-500 py-12">Loading products...</div>
        ) : products.length === 0 ? (
          <div className="text-center py-12">
            <div className="max-w-md mx-auto">
              <p className="text-xl font-semibold text-gray-700 mb-2">No products available</p>
              <p className="text-gray-500 mb-4">
                {filters.query || filters.fandom || filters.category
                  ? 'No products match your search criteria. Try adjusting your filters.'
                  : 'There are currently no products available. Please check back later.'}
              </p>
              {(filters.query || filters.fandom || filters.category) && (
                <button
                  onClick={() => {
                    setFilters({
                      query: '',
                      fandom: '',
                      category: '',
                      sortBy: 'newest',
                    });
                  }}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
            {paginationControls}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}


