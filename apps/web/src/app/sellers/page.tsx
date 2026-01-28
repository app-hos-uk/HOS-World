'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { apiClient } from '@/lib/api';
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
      // Get users with seller roles - using admin endpoint if available, or search by products
      const response = await apiClient.getUsers();
      const raw = response?.data as { data?: unknown[] } | unknown[] | undefined;
      const userData = Array.isArray(raw) ? raw : (raw as { data?: unknown[] })?.data ?? [];
      const users = Array.isArray(userData) ? userData : [];
      if (users.length > 0) {
        const sellerRoles = ['SELLER', 'B2C_SELLER', 'WHOLESALER'];
        const sellerUsers = users.filter((user: any) => 
          sellerRoles.includes(user.role)
        );
        // For each seller, try to get their profile
        const sellersWithProfiles = await Promise.all(
          sellerUsers.map(async (user: any) => {
            try {
              // Try to get seller profile by slug or userId
              const products = await apiClient.getProducts({ sellerId: user.id, limit: 1 });
              const productData = products?.data as any;
              return {
                ...user,
                hasProducts: (productData?.items || productData?.data || []).length > 0,
              };
            } catch {
              return { ...user, hasProducts: false };
            }
          })
        );
        setSellers(sellersWithProfiles);
      } else {
        setSellers([]); // Clear sellers when no users found to prevent stale data
      }
    } catch (err: any) {
      console.error('Error fetching sellers:', err);
      // Fallback: show empty state
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
          <div className="text-center text-gray-500 py-12">Loading sellers...</div>
        ) : sellers.length === 0 ? (
          <div className="text-center text-gray-500 py-12">No sellers found</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {sellers.map((seller) => (
              <Link
                key={seller.id}
                href={`/sellers/${seller.id}`}
                className="group bg-white border rounded-lg p-6 hover:shadow-lg transition-shadow"
              >
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto mb-4 bg-purple-100 rounded-full flex items-center justify-center">
                    <span className="text-2xl">🏪</span>
                  </div>
                  <h3 className="font-semibold text-gray-900 group-hover:text-purple-600 transition-colors">
                    {seller.firstName} {seller.lastName}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">{seller.email}</p>
                  {seller.hasProducts && (
                    <span className="inline-block mt-2 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                      Has Products
                    </span>
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



