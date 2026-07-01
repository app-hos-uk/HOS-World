'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { DashboardLayout } from '@/components/DashboardLayout';
import { apiClient } from '@/lib/api';
import { getSellerMenuItems } from '@/lib/sellerMenu';
import { useCurrency } from '@/contexts/CurrencyContext';
import Link from 'next/link';
import Image from 'next/image';
import { PortalMobileCard } from '@/components/ui/PortalMobileCard';
import { PORTAL_INPUT_CLASS, PORTAL_SELECT_CLASS } from '@/lib/portalFieldClasses';

export default function WholesalerProductsPage() {
  const { formatPrice } = useCurrency();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('newest');

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

  const filteredProducts = products
    .filter((p) => {
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      return (
        p.name?.toLowerCase().includes(q) ||
        p.slug?.toLowerCase().includes(q) ||
        p.status?.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'name':
          return (a.name || '').localeCompare(b.name || '');
        case 'price-high':
          return parseFloat(b.price || 0) - parseFloat(a.price || 0);
        case 'price-low':
          return parseFloat(a.price || 0) - parseFloat(b.price || 0);
        case 'stock-high':
          return (b.stock || 0) - (a.stock || 0);
        case 'stock-low':
          return (a.stock || 0) - (b.stock || 0);
        case 'newest':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

  return (
    <RouteGuard allowedRoles={['WHOLESALER', 'ADMIN']} showAccessDenied={true}>
      <DashboardLayout role="WHOLESALER" menuItems={menuItems} title="Wholesaler" backToHref={{ title: 'Admin Dashboard', href: '/admin/dashboard' }}>
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-hos-text-secondary">My Products</h1>
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

        {!loading && !error && products.length > 0 && (
          <div className="bg-hos-bg-secondary rounded-lg shadow p-4 mb-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search products by name or slug..."
                className={PORTAL_INPUT_CLASS}
              />
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={PORTAL_SELECT_CLASS}>
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="name">Name A-Z</option>
                <option value="price-high">Price: High to Low</option>
                <option value="price-low">Price: Low to High</option>
                <option value="stock-high">Stock: High to Low</option>
                <option value="stock-low">Stock: Low to High</option>
              </select>
            </div>
          </div>
        )}

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
            {filteredProducts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-hos-text-muted mb-4">
                  {products.length === 0 ? 'No products found' : 'No products match your search'}
                </p>
                {products.length === 0 && (
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
                )}
              </div>
            ) : (
              <>
              <div className="md:hidden space-y-3 p-4">
                {filteredProducts.map((product) => (
                  <PortalMobileCard
                    key={product.id}
                    title={product.name}
                    subtitle={product.slug}
                    rows={[
                      {
                        label: 'Status',
                        value: (
                          <span
                            className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${
                              product.status === 'ACTIVE'
                                ? 'bg-green-500/15 text-green-300'
                                : product.status === 'INACTIVE'
                                  ? 'bg-hos-bg-tertiary text-hos-text-secondary'
                                  : 'bg-yellow-500/15 text-yellow-300'
                            }`}
                          >
                            {product.status}
                          </span>
                        ),
                      },
                      { label: 'Price', value: formatPrice(parseFloat(product.price || 0)) },
                      { label: 'Stock', value: product.stock ?? 0 },
                      { label: 'Min. Order', value: product.quantity || '—' },
                      { label: 'Created', value: new Date(product.createdAt).toLocaleDateString() },
                    ]}
                    actions={
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/seller/products/${product.id}/pricing`}
                          className="text-hos-gold hover:text-hos-gold-hover text-sm font-medium"
                        >
                          Pricing tiers
                        </Link>
                        <Link
                          href={`/products/${product.slug || product.id}`}
                          className="text-hos-text-muted hover:text-hos-gold text-sm font-medium"
                        >
                          View
                        </Link>
                      </div>
                    }
                  />
                ))}
              </div>
              <div className="hidden md:block overflow-x-auto">
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
                      <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-hos-bg-secondary divide-y divide-hos-border">
                    {filteredProducts.map((product) => (
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
                              <div className="text-sm font-medium text-hos-text-secondary">{product.name}</div>
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
                                  ? 'bg-hos-bg-tertiary text-hos-text-secondary'
                                  : 'bg-yellow-500/15 text-yellow-300'
                            }`}
                          >
                            {product.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-hos-text-secondary">
                          {formatPrice(parseFloat(product.price || 0))}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-hos-text-secondary">
                          {product.stock ?? 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-hos-text-secondary">
                          {product.quantity || '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-hos-text-muted">
                          {new Date(product.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <Link
                              href={`/seller/products/${product.id}/pricing`}
                              className="text-hos-gold hover:text-hos-gold-hover text-sm font-medium"
                            >
                              Pricing tiers
                            </Link>
                            <Link
                              href={`/products/${product.slug || product.id}`}
                              className="text-hos-text-muted hover:text-hos-gold text-sm font-medium"
                            >
                              View
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            )}
          </div>
        )}
      </DashboardLayout>
    </RouteGuard>
  );
}

