'use client';

import { useEffect, useState, useMemo } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { DashboardLayout } from '@/components/DashboardLayout';
import { apiClient } from '@/lib/api';
import { getSellerMenuItems } from '@/lib/sellerMenu';
import { useToast } from '@/hooks/useToast';
import { useCurrency } from '@/contexts/CurrencyContext';
import Link from 'next/link';
import Image from 'next/image';
import { PortalMobileCard } from '@/components/ui/PortalMobileCard';

interface Product {
  id: string;
  name: string;
  slug?: string;
  status: string;
  price: number;
  stock: number;
  images?: string[];
  createdAt: string;
  category?: string;
  fandom?: string;
}

/** Row that can be a product or a submission (pending review) */
type ProductRow = Product & { _isSubmission?: boolean; _submissionId?: string };

/** Submission shape from API (minimal for list) */
interface SubmissionItem {
  id: string;
  productId?: string;
  product?: { id: string };
  productData?: { name?: string; price?: number; stock?: number; images?: Array<{ url?: string }>; category?: string; fandom?: string };
  createdAt?: string;
}

export default function SellerProductsPage() {
  const toast = useToast();
  const { formatPrice } = useCurrency();
  const [products, setProducts] = useState<Product[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('newest');

  const menuItems = getSellerMenuItems(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const [productsRes, submissionsRes] = await Promise.all([
        apiClient.getSellerProducts(),
        apiClient.getSellerSubmissions(),
      ]);
      if (productsRes?.data) {
        setProducts(Array.isArray(productsRes.data) ? productsRes.data : []);
      }
      if (submissionsRes?.data) {
        setSubmissions(Array.isArray(submissionsRes.data) ? submissionsRes.data : []);
      }
    } catch (err: any) {
      console.error('Error fetching products:', err);
      setError(err?.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  // Submissions that don't yet have an associated product (pending review)
  const pendingSubmissions = useMemo(() => {
    return submissions.filter((s) => !s.productId && !s.product?.id);
  }, [submissions]);

  // Combined list: products + pending submissions (so list isn't empty after submit)
  const productRows: ProductRow[] = useMemo(() => {
    const rows: ProductRow[] = products.map((p) => ({ ...p, _isSubmission: false }));
    pendingSubmissions.forEach((s) => {
      const data = s.productData || {};
      rows.push({
        id: `sub-${s.id}`,
        name: data.name || 'Untitled',
        status: 'PENDING', // so they show under Pending filter and as "Pending review"
        price: Number(data.price) || 0,
        stock: Number(data.stock) || 0,
        images: data.images?.map((i: any) => i?.url).filter(Boolean) || [],
        createdAt: s.createdAt || new Date().toISOString(),
        category: data.category,
        fandom: data.fandom,
        _isSubmission: true,
        _submissionId: s.id,
      });
    });
    return rows;
  }, [products, pendingSubmissions]);

  // Calculate stats (products only for active/inactive/stock; total includes pending submissions)
  const stats = useMemo(() => {
    const active = products.filter(p => p.status === 'ACTIVE').length;
    const inactive = products.filter(p => p.status === 'INACTIVE').length;
    const pending = products.filter(p => ['PENDING', 'PENDING_REVIEW', 'DRAFT'].includes(p.status)).length + pendingSubmissions.length;
    const outOfStock = products.filter(p => (p.stock || 0) <= 0 && p.status === 'ACTIVE').length;
    const lowStock = products.filter(p => p.stock > 0 && p.stock <= 5 && p.status === 'ACTIVE').length;
    const totalValue = products.reduce((sum, p) => sum + ((p.price || 0) * (p.stock || 0)), 0);

    return { total: productRows.length, active, inactive, pending, outOfStock, lowStock, totalValue };
  }, [products, pendingSubmissions, productRows.length]);

  // Filter and sort products (combined list)
  const filteredProducts = useMemo(() => {
    let result = [...productRows];

    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      result = result.filter(p => 
        p.name.toLowerCase().includes(search) ||
        p.slug?.toLowerCase().includes(search) ||
        p.category?.toLowerCase().includes(search) ||
        p.fandom?.toLowerCase().includes(search)
      );
    }

    // Apply status filter
    if (statusFilter) {
      if (statusFilter === 'OUT_OF_STOCK') {
        result = result.filter(p => (p.stock || 0) <= 0);
      } else if (statusFilter === 'LOW_STOCK') {
        result = result.filter(p => p.stock > 0 && p.stock <= 5);
      } else {
        result = result.filter(p => p.status === statusFilter);
      }
    }

    // Apply sorting
    switch (sortBy) {
      case 'newest':
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'oldest':
        result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case 'price-high':
        result.sort((a, b) => (b.price || 0) - (a.price || 0));
        break;
      case 'price-low':
        result.sort((a, b) => (a.price || 0) - (b.price || 0));
        break;
      case 'stock-high':
        result.sort((a, b) => (b.stock || 0) - (a.stock || 0));
        break;
      case 'stock-low':
        result.sort((a, b) => (a.stock || 0) - (b.stock || 0));
        break;
      case 'name':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }

    return result;
  }, [productRows, searchTerm, statusFilter, sortBy]);

  const getStatusColor = (status: string, stock: number) => {
    if (stock <= 0) return 'bg-red-500/15 text-red-300';
    switch (status) {
      case 'ACTIVE': return 'bg-green-500/15 text-green-300';
      case 'INACTIVE': return 'bg-hos-bg-tertiary text-hos-text-secondary';
      case 'PENDING':
      case 'PENDING_REVIEW':
      case 'DRAFT': return 'bg-yellow-500/15 text-yellow-300';
      default: return 'bg-hos-bg-tertiary text-hos-text-secondary';
    }
  };

  const getDisplayStatus = (status: string, stock: number) => {
    if (stock <= 0) return 'Out of Stock';
    return status;
  };

  return (
    <RouteGuard allowedRoles={['B2C_SELLER', 'SELLER', 'WHOLESALER', 'ADMIN']} showAccessDenied={true}>
      <DashboardLayout role="SELLER" menuItems={menuItems} title="Seller" backToHref={{ title: 'Admin Dashboard', href: '/admin/dashboard' }}>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-hos-text-secondary">My Products</h1>
              <p className="text-hos-text-secondary mt-1">Manage your product listings</p>
            </div>
            <div className="flex gap-2">
              <Link
                href="/seller/products/bulk"
                className="px-4 py-2 border border-hos-border text-hos-text-secondary rounded-lg hover:bg-hos-bg-tertiary transition-colors font-medium"
              >
                Bulk Import/Export
              </Link>
              <Link
                href="/seller/submit-product"
                className="px-6 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors font-medium"
              >
                + Add Product
              </Link>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <button
              onClick={() => setStatusFilter('')}
              className={`bg-hos-bg-secondary rounded-lg shadow p-4 text-left ${statusFilter === '' ? 'ring-2 ring-hos-gold/50' : ''}`}
            >
              <h3 className="text-xs font-medium text-hos-text-muted uppercase">Total</h3>
              <p className="text-2xl font-bold text-hos-text-secondary mt-1">{stats.total}</p>
            </button>
            <button
              onClick={() => setStatusFilter('ACTIVE')}
              className={`bg-hos-bg-secondary rounded-lg shadow p-4 text-left ${statusFilter === 'ACTIVE' ? 'ring-2 ring-hos-gold/50' : ''}`}
            >
              <h3 className="text-xs font-medium text-hos-text-muted uppercase">Active</h3>
              <p className="text-2xl font-bold text-green-400 mt-1">{stats.active}</p>
            </button>
            <button
              onClick={() => setStatusFilter('INACTIVE')}
              className={`bg-hos-bg-secondary rounded-lg shadow p-4 text-left ${statusFilter === 'INACTIVE' ? 'ring-2 ring-hos-gold/50' : ''}`}
            >
              <h3 className="text-xs font-medium text-hos-text-muted uppercase">Inactive</h3>
              <p className="text-2xl font-bold text-hos-text-secondary mt-1">{stats.inactive}</p>
            </button>
            <button
              onClick={() => setStatusFilter('PENDING')}
              className={`bg-hos-bg-secondary rounded-lg shadow p-4 text-left ${statusFilter === 'PENDING' ? 'ring-2 ring-hos-gold/50' : ''}`}
            >
              <h3 className="text-xs font-medium text-hos-text-muted uppercase">Pending</h3>
              <p className="text-2xl font-bold text-yellow-400 mt-1">{stats.pending}</p>
            </button>
            <button
              onClick={() => setStatusFilter('OUT_OF_STOCK')}
              className={`bg-hos-bg-secondary rounded-lg shadow p-4 text-left ${statusFilter === 'OUT_OF_STOCK' ? 'ring-2 ring-hos-gold/50' : ''}`}
            >
              <h3 className="text-xs font-medium text-hos-text-muted uppercase">Out of Stock</h3>
              <p className="text-2xl font-bold text-red-400 mt-1">{stats.outOfStock}</p>
            </button>
            <button
              onClick={() => setStatusFilter('LOW_STOCK')}
              className={`bg-hos-bg-secondary rounded-lg shadow p-4 text-left ${statusFilter === 'LOW_STOCK' ? 'ring-2 ring-hos-gold/50' : ''}`}
            >
              <h3 className="text-xs font-medium text-hos-text-muted uppercase">Low Stock</h3>
              <p className="text-2xl font-bold text-orange-400 mt-1">{stats.lowStock}</p>
            </button>
            <div className="bg-hos-bg-secondary rounded-lg shadow p-4">
              <h3 className="text-xs font-medium text-hos-text-muted uppercase">Inventory Value</h3>
              <p className="text-xl font-bold text-green-400 mt-1">${stats.totalValue.toFixed(2)}</p>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="bg-hos-bg-secondary rounded-lg shadow p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search products by name, category, or fandom..."
                  className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold focus:outline-none"
                />
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold focus:outline-none"
              >
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

          {/* Error State */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded">
              Error: {error}
              <button
                onClick={fetchProducts}
                className="ml-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Retry
              </button>
            </div>
          )}

          {/* Products Table */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-hos-gold"></div>
            </div>
          ) : (
            <div className="bg-hos-bg-secondary rounded-lg shadow overflow-hidden">
              {filteredProducts.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-hos-text-muted mb-4">
                    {productRows.length === 0 ? 'No products found' : 'No products match your filters'}
                  </p>
                  {productRows.length === 0 && (
                    <Link
                      href="/seller/submit-product"
                      className="text-hos-gold hover:text-hos-gold-hover font-medium"
                    >
                      Submit your first product →
                    </Link>
                  )}
                </div>
              ) : (
                <>
                <div className="md:hidden space-y-3 p-4">
                  {filteredProducts.map((product) => (
                    <PortalMobileCard
                      key={product.id}
                      title={product.name}
                      subtitle={product.slug || (product._isSubmission ? 'Pending review' : '')}
                      rows={[
                        {
                          label: 'Status',
                          value: (
                            <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${product._isSubmission ? 'bg-amber-500/15 text-amber-300' : getStatusColor(product.status, product.stock || 0)}`}>
                              {product._isSubmission ? 'Pending review' : getDisplayStatus(product.status, product.stock || 0)}
                            </span>
                          ),
                        },
                        { label: 'Price', value: formatPrice(Number(product.price || 0)) },
                        { label: 'Stock', value: product.stock ?? 0 },
                        { label: 'Fandom', value: product.category || product.fandom || '—' },
                        { label: 'Created', value: new Date(product.createdAt).toLocaleDateString() },
                      ]}
                      actions={
                        !product._isSubmission ? (
                          <Link
                            href={`/products/${product.slug || product.id}`}
                            className="text-hos-gold hover:text-hos-gold-hover text-sm font-medium"
                          >
                            View
                          </Link>
                        ) : undefined
                      }
                    />
                  ))}
                </div>
                <div className="hidden md:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-hos-border">
                    <thead className="bg-hos-bg-secondary">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Product</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Price</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Stock</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Fandom</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Created</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-hos-bg-secondary divide-y divide-hos-border">
                      {filteredProducts.map((product) => (
                        <tr key={product.id} className="hover:bg-hos-bg-tertiary">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              {product.images && product.images[0] ? (
                                <Image
                                  className="rounded-lg object-cover mr-3"
                                  src={product.images[0]}
                                  alt={product.name}
                                  width={48}
                                  height={48}
                                />
                              ) : (
                                <div className="h-12 w-12 rounded-lg bg-hos-bg-tertiary mr-3 flex items-center justify-center">
                                  <span className="text-hos-text-muted text-xs">No img</span>
                                </div>
                              )}
                              <div>
                                <div className="text-sm font-medium text-hos-text-secondary">{product.name}</div>
                                <div className="text-sm text-hos-text-muted">{product.slug || (product._isSubmission ? 'Pending review' : '')}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${product._isSubmission ? 'bg-amber-500/15 text-amber-300' : getStatusColor(product.status, product.stock || 0)}`}>
                              {product._isSubmission ? 'Pending review' : getDisplayStatus(product.status, product.stock || 0)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-hos-text-secondary">
                            {formatPrice(Number(product.price || 0))}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`text-sm font-medium ${
                              (product.stock || 0) <= 0 ? 'text-red-400' :
                              product.stock <= 5 ? 'text-orange-400' :
                              'text-hos-text-secondary'
                            }`}>
                              {product.stock || 0}
                            </span>
                            {(product.stock || 0) <= 5 && product.stock > 0 && (
                              <span className="ml-2 text-xs text-orange-400">(Low)</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-hos-text-muted">
                            {product.category || product.fandom || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-hos-text-muted">
                            {new Date(product.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {!product._isSubmission && (
                              <Link
                                href={`/products/${product.slug || product.id}`}
                                className="text-hos-gold hover:text-hos-gold-hover text-sm font-medium"
                              >
                                View
                              </Link>
                            )}
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

          {/* Results Count */}
          {!loading && productRows.length > 0 && (
            <div className="text-sm text-hos-text-muted text-center">
              Showing {filteredProducts.length} of {productRows.length} items
              {pendingSubmissions.length > 0 && (
                <span className="ml-2">({pendingSubmissions.length} pending review)</span>
              )}
            </div>
          )}
        </div>
      </DashboardLayout>
    </RouteGuard>
  );
}
