'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { DashboardLayout } from '@/components/DashboardLayout';
import { apiClient } from '@/lib/api';
import { useCurrency } from '@/contexts/CurrencyContext';
import Link from 'next/link';
import Image from 'next/image';

export default function WholesalerProductsPage() {
  const { formatPrice } = useCurrency();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const menuItems = [
    { title: 'Dashboard', href: '/wholesaler/dashboard', icon: '📊' },
    { title: 'Submit Product', href: '/seller/submit-product', icon: '➕' },
    { title: 'My Products', href: '/wholesaler/products', icon: '📦' },
    { title: 'Bulk Orders', href: '/wholesaler/orders', icon: '🛒' },
    { title: 'Submissions', href: '/wholesaler/submissions', icon: '📝' },
    { title: 'Profile', href: '/wholesaler/profile', icon: '👤' },
    { title: 'Bulk Import', href: '/wholesaler/bulk', icon: '📥' },
  ];

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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Bulk Products</h1>
              <p className="text-gray-600 mt-2">Manage your wholesale product listings</p>
            </div>
            <Link
              href="/seller/submit-product"
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
            >
              + Add Bulk Product
            </Link>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
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
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {products.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">No products found</p>
                <Link
                  href="/seller/submit-product"
                  className="text-purple-600 hover:text-purple-700 font-medium"
                >
                  Submit your first bulk product →
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Product
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Price
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Quantity
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {products.map((product) => (
                      <tr key={product.id} className="hover:bg-gray-50">
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
                              <div className="text-sm font-medium text-gray-900">{product.name}</div>
                              <div className="text-sm text-gray-500">{product.slug}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded ${
                              product.status === 'ACTIVE'
                                ? 'bg-green-100 text-green-800'
                                : product.status === 'INACTIVE'
                                  ? 'bg-gray-100 text-gray-800'
                                  : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {product.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatPrice(parseFloat(product.price || 0))}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {product.quantity || product.stock || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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

