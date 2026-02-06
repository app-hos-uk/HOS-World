'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { apiClient } from '@/lib/api';
import { useCurrency } from '@/contexts/CurrencyContext';

interface SellerProfile {
  id: string;
  userId: string;
  storeName: string;
  slug: string;
  description?: string;
  logo?: string;
  country: string;
  city?: string;
  region?: string;
  rating?: number;
  totalSales?: number;
  sellerType: string;
  verified?: boolean;
  createdAt: string;
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    avatar?: string;
  };
}

interface Product {
  id: string;
  name: string;
  slug: string;
  description?: string;
  shortDescription?: string;
  price: number;
  currency?: string;
  stock: number;
  status: string;
  images?: Array<{ url: string; alt?: string }>;
  averageRating?: number;
  reviewCount?: number;
}

export default function SellerStorefrontPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const { formatPrice } = useCurrency();

  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'newest' | 'price-asc' | 'price-desc' | 'name'>('newest');

  useEffect(() => {
    if (slug) {
      fetchSellerData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const fetchSellerData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch seller profile by slug
      const sellerResponse = await apiClient.getSellerBySlug(slug);
      if (!sellerResponse?.data) {
        setError('Seller not found');
        return;
      }

      const sellerData = sellerResponse.data;
      setSeller(sellerData);

      // Fetch seller's active products
      // Note: the products API expects userId as sellerId for filtering
      try {
        const productsResponse = await apiClient.getProducts({
          sellerId: sellerData.userId,
          status: 'ACTIVE',
          limit: 50,
        } as any);
        const productList = productsResponse?.data;
        const items = Array.isArray(productList)
          ? productList
          : (productList as any)?.items || (productList as any)?.data || [];
        setProducts(Array.isArray(items) ? items : []);
      } catch {
        // Seller may have no products
        setProducts([]);
      }
    } catch (err: any) {
      console.error('Error fetching seller:', err);
      setError(err.message || 'Seller not found');
    } finally {
      setLoading(false);
    }
  };

  const sortedProducts = [...products].sort((a, b) => {
    switch (sortBy) {
      case 'price-asc':
        return (a.price || 0) - (b.price || 0);
      case 'price-desc':
        return (b.price || 0) - (a.price || 0);
      case 'name':
        return a.name.localeCompare(b.name);
      case 'newest':
      default:
        return 0; // Keep API order (newest)
    }
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <main className="container mx-auto px-4 py-12">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !seller) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <main className="container mx-auto px-4 py-12">
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🏪</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Store Not Found</h1>
            <p className="text-gray-600 mb-6">
              The store you are looking for does not exist or has been removed.
            </p>
            <Link
              href="/sellers"
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Browse All Sellers
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main>
        {/* Store Banner */}
        <div className="bg-gradient-to-r from-purple-700 to-indigo-800 text-white">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              {/* Store Logo/Avatar */}
              <div className="flex-shrink-0">
                {seller.logo ? (
                  <Image
                    src={seller.logo}
                    alt={seller.storeName}
                    width={96}
                    height={96}
                    className="rounded-xl object-cover border-4 border-white/20"
                  />
                ) : seller.user.avatar ? (
                  <Image
                    src={seller.user.avatar}
                    alt={seller.storeName}
                    width={96}
                    height={96}
                    className="rounded-xl object-cover border-4 border-white/20"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-xl bg-white/20 flex items-center justify-center text-4xl border-4 border-white/20">
                    🏪
                  </div>
                )}
              </div>

              {/* Store Info */}
              <div className="flex-1">
                <h1 className="text-2xl sm:text-3xl font-bold">{seller.storeName}</h1>
                {seller.description && (
                  <p className="mt-2 text-purple-100 text-sm sm:text-base max-w-2xl line-clamp-2">
                    {seller.description}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-3 mt-3">
                  {seller.verified && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium bg-green-500/20 text-green-100 px-2.5 py-1 rounded-full">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Verified Seller
                    </span>
                  )}
                  {seller.rating != null && seller.rating > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium bg-yellow-500/20 text-yellow-100 px-2.5 py-1 rounded-full">
                      <span className="text-yellow-300">★</span>
                      {seller.rating.toFixed(1)}
                    </span>
                  )}
                  {seller.country && (
                    <span className="text-xs text-purple-200">
                      {[seller.city, seller.country].filter(Boolean).join(', ')}
                    </span>
                  )}
                  <span className="text-xs text-purple-200">
                    Member since {new Date(seller.createdAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                  </span>
                </div>
              </div>

              {/* Stats */}
              <div className="flex gap-6 text-center">
                <div>
                  <p className="text-2xl font-bold">{products.length}</p>
                  <p className="text-xs text-purple-200">Products</p>
                </div>
                {(seller.totalSales ?? 0) > 0 && (
                  <div>
                    <p className="text-2xl font-bold">{seller.totalSales}</p>
                    <p className="text-xs text-purple-200">Sales</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Products Section */}
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Sort Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h2 className="text-xl font-bold text-gray-900">
              Products
              <span className="text-sm font-normal text-gray-500 ml-2">({products.length})</span>
            </h2>
            {products.length > 1 && (
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
              >
                <option value="newest">Newest First</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="name">Name A-Z</option>
              </select>
            )}
          </div>

          {/* Product Grid */}
          {products.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
              <div className="text-5xl mb-4">📦</div>
              <p className="text-gray-500 text-lg">This seller has no products yet.</p>
              <Link
                href="/products"
                className="inline-block mt-4 text-purple-600 hover:text-purple-800 font-medium"
              >
                Browse all products
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {sortedProducts.map((product) => (
                <Link
                  key={product.id}
                  href={`/products/${product.id}`}
                  className="group bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow"
                >
                  {/* Product Image */}
                  <div className="aspect-square bg-gray-100 relative overflow-hidden">
                    {product.images?.[0]?.url ? (
                      <Image
                        src={product.images[0].url}
                        alt={product.images[0].alt || product.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 text-5xl">
                        📦
                      </div>
                    )}
                    {product.stock === 0 && (
                      <div className="absolute top-2 right-2 px-2 py-1 bg-red-600 text-white text-xs font-medium rounded">
                        Out of Stock
                      </div>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="p-4">
                    <h3 className="font-medium text-gray-900 group-hover:text-purple-600 transition-colors line-clamp-2 text-sm">
                      {product.name}
                    </h3>
                    {product.shortDescription && (
                      <p className="mt-1 text-xs text-gray-500 line-clamp-1">
                        {product.shortDescription}
                      </p>
                    )}
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-lg font-bold text-purple-600">
                        {formatPrice(product.price, product.currency || 'GBP')}
                      </p>
                      {product.averageRating != null && product.averageRating > 0 && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <span className="text-yellow-400">★</span>
                          {product.averageRating.toFixed(1)}
                          {product.reviewCount != null && (
                            <span>({product.reviewCount})</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
