'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { DashboardLayout } from '@/components/DashboardLayout';
import { apiClient } from '@/lib/api';
import { getSellerMenuItems } from '@/lib/sellerMenu';
import { useCurrency } from '@/contexts/CurrencyContext';
import Link from 'next/link';
import Image from 'next/image';

export default function WholesalerProductsPage() {
  const { formatPrice } = useCurrency();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const menuItems = getSellerMenuItems(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getWholesalerProducts();
      if (response?.data) {
        setProducts(Array.isArray(response.data) ? response.data : []);
      }
    } catch (err: any) {
      console.error('Error fetching products:', err);
      setError(err.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  return (
    <RouteGuard allowedRoles={['WHOLESALER', 'ADMIN']} showAccessDenied={true}>
      <DashboardLayout role="WHOLESALER" menuItems={menuItems} title="Wholesaler">
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">My Products</h1>
              <p className="text-hos-text-secondary mt-2">Manage your wholesale product listings</p>
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <Link
                href="/wholesaler/bulk"
                className="inline-flex items-center justify-center px-5 py-3 border-2 border-hos-gold text-hos-gold-hover rounded-lg hover:bg-hos-gold/10 transition-colors font-medium"
              >
                Bulk upload (CSV)
              </Link>
              <Link
                href="/wholesaler/submit-product"
                className="inline-flex items-center justify-center px-6 py-3 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors font-medium"
              >
                + Add product
              </Link>
            </div>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-hos-gold"></div>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded mb-6">
            Error: {error}
            <button
              onClick={fetchProducts}
              className="ml-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && (
          <div className="bg-hos-bg-secondary rounded-lg shadow overflow-hidden">
            {products.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-hos-text-muted mb-4">No products found</p>
                <div className="flex flex-wrap gap-3 justify-center">
                  <Link
                    href="/wholesaler/bulk"
                    className="text-hos-gold-hover font-medium border border-hos-border-accent rounded-lg px-4 py-2 hover:bg-hos-gold/10"
                  >
                    Bulk upload (CSV) →
                  </Link>
                  <Link
                    href="/wholesaler/submit-product"
                    className="text-hos-gold hover:text-hos-gold-hover font-medium"
                  >
                    Add a single product →
                  </Link>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-hos-border">
                  <thead className="bg-hos-bg-secondary">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                        Product
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                        Price
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                        Stock
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                        Min. Order
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                        Created
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-hos-bg-secondary divide-y divide-hos-border">
                    {products.map((product) => (
                      <tr key={product.id} className="hover:bg-hos-bg-tertiary">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {product.images && product.images[0] && (
                              <Image
                                className="rounded-lg object-cover mr-3"
                                src={typeof product.images[0] === 'string' ? product.images[0] : product.images[0].url}
                                alt={product.name}
                                width={40}
                                height={40}
                              />
                            )}
                            <div>
                              <div className="text-sm font-medium text-white">{product.name}</div>
                              <div className="text-sm text-hos-text-muted">{product.slug}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded ${
                              product.status === 'ACTIVE'
                                ? 'bg-green-500/15 text-green-300'
                                : product.status === 'INACTIVE'
                                  ? 'bg-hos-bg-tertiary text-white'
                                  : 'bg-yellow-500/15 text-yellow-300'
                            }`}
                          >
                            {product.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                          {formatPrice(parseFloat(product.price || 0))}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                          {product.stock ?? 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                          {product.quantity || '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-hos-text-muted">
                          {new Date(product.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </DashboardLayout>
    </RouteGuard>
  );
}

