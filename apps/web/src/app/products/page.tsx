'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { apiClient } from '@/lib/api';
import Link from 'next/link';
import Image from 'next/image';

function ProductsContent() {
  const searchParams = useSearchParams();
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

  // Read query parameter from URL on mount and when searchParams change
  // Use searchParams.toString() to get a stable string representation that only changes when actual params change
  const searchQuery = searchParams.get('q') || '';
  
  useEffect(() => {
    // useSearchParams().get() already returns URL-decoded values, so no need for decodeURIComponent()
    const queryParam = searchParams.get('q');
    const newQuery = queryParam || '';
    
    setFilters(prev => ({
      ...prev,
      query: newQuery,
    }));
    
    // Reset to page 1 when search query changes (added or removed)
    // This ensures users start at page 1 when switching between search and browse
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]); // Use the extracted query value instead of the entire searchParams object

  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filters]); // Removed searchParams - filters already updates when searchParams changes via the first effect

  const fetchProducts = async () => {
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
  };

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
            onChange={(e) => {
              setFilters({ ...filters, query: e.target.value });
              setPage(1); // Reset to page 1 when search query changes manually
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          />
          <select
            value={filters.sortBy}
            onChange={(e) => setFilters({ ...filters, sortBy: e.target.value as typeof filters.sortBy })}
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
          <div className="text-center text-gray-500 py-12">No products found</div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {products.map((product) => (
                <Link key={product.id} href={`/products/${product.id}`} className="group">
                  <div className="bg-white border rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
                    <div className="aspect-square bg-gray-100 relative">
                      {product.images && product.images[0] ? (
                        <Image
                          src={product.images[0].url}
                          alt={product.name}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          No Image
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-gray-900 group-hover:text-purple-600 transition-colors">
                        {product.name}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{product.description}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-lg font-bold text-purple-900">
                          £{Number(product.price).toFixed(2)}
                        </span>
                        {product.fandom && (
                          <span className="text-xs text-gray-500">{product.fandom}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="mt-8 flex justify-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border rounded-lg disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="px-4 py-2">Page {page} of {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 border rounded-lg disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p className="text-sm sm:text-base text-gray-600">Loading products...</p>
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



