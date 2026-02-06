'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { apiClient } from '@/lib/api';
import Image from 'next/image';
import Link from 'next/link';

export default function SellersPage() {
  const [sellers, setSellers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSellers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchSellers = async () => {
    try {
      setLoading(true);
      // Use the public sellers directory endpoint (no auth required)
      const response = await apiClient.getPublicSellers();
      const raw = response?.data;
      const sellerData = Array.isArray(raw) ? raw : [];

      if (sellerData.length > 0) {
        // Map seller profiles to display data
        const mapped = sellerData.map((seller: any) => ({
          id: seller.id,
          slug: seller.slug,
          storeName: seller.storeName || 'Unnamed Store',
          description: seller.description || '',
          logo: seller.logo || seller.user?.avatar || '',
          country: seller.country || '',
          city: seller.city || '',
          verified: seller.verified,
          rating: seller.rating,
          totalProducts: seller._count?.products || 0,
          sellerType: seller.sellerType || '',
          createdAt: seller.createdAt || '',
        }));
        setSellers(mapped);
      } else {
        setSellers([]);
      }
    } catch (err: any) {
      console.error('Error fetching sellers:', err);
      setSellers([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4 sm:mb-6 lg:mb-8">Sellers</h1>
        <p className="text-base sm:text-lg text-gray-600 mb-6 sm:mb-8">
          Browse our marketplace sellers and their collections
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        ) : sellers.length === 0 ? (
          <div className="text-center text-gray-500 py-12">No sellers found</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {sellers.map((seller) => (
              <Link
                key={seller.id}
                href={`/sellers/${seller.slug}`}
                className="group bg-white border rounded-lg p-6 hover:shadow-lg transition-shadow"
              >
                <div className="text-center">
                  {seller.logo ? (
                    <div className="w-20 h-20 mx-auto mb-4 rounded-full overflow-hidden">
                      <Image src={seller.logo} alt={seller.storeName} width={80} height={80} className="object-cover w-full h-full" />
                    </div>
                  ) : (
                    <div className="w-20 h-20 mx-auto mb-4 bg-purple-100 rounded-full flex items-center justify-center">
                      <span className="text-2xl">🏪</span>
                    </div>
                  )}
                  <h3 className="font-semibold text-gray-900 group-hover:text-purple-600 transition-colors">
                    {seller.storeName}
                  </h3>
                  {seller.country && (
                    <p className="text-sm text-gray-500 mt-1">
                      {[seller.city, seller.country].filter(Boolean).join(', ')}
                    </p>
                  )}
                  <div className="flex items-center justify-center gap-2 mt-2">
                    {seller.verified && (
                      <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Verified</span>
                    )}
                    {seller.totalProducts > 0 && (
                      <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                        {seller.totalProducts} product{seller.totalProducts !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  {seller.rating != null && seller.rating > 0 && (
                    <div className="mt-2 text-sm text-gray-500">
                      <span className="text-yellow-400">★</span> {seller.rating.toFixed(1)}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

