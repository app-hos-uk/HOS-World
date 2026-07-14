'use client';

import { useEffect, useState, useMemo } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useRouter } from 'next/navigation';

interface TaxClass {
  id: string;
  name: string;
  description?: string;
  rates?: Array<{ rate: number; taxZone?: { name: string } }>;
}

/**
 * Price Management Interface
 * 
 * This interface is for the Finance/Pricing team to manage product pricing, stock, and tax.
 * Products must be created first in the Product Creation interface.
 * 
 * Access: FINANCE, ADMIN roles
 */
export default function PriceManagementPage() {
  const router = useRouter();
  const toast = useToast();
  const [products, setProducts] = useState<any[]>([]);
  const [taxClasses, setTaxClasses] = useState<TaxClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFT' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [pricingData, setPricingData] = useState({
    price: '',
    tradePrice: '',
    rrp: '',
    stock: '0',
    taxClassId: '',
    taxRate: '',
    currency: 'USD',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;

  useEffect(() => {
    fetchProducts();
    fetchTaxClasses();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getAdminProducts({ page: 1, limit: 500 });
      const list = response?.data?.products || response?.data?.data || [];
      setProducts(Array.isArray(list) ? list : []);
    } catch (err: any) {
      console.error('Error fetching products:', err);
      setError(err.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const fetchTaxClasses = async () => {
    try {
      const response = await apiClient.getTaxClasses();
      const classes = response?.data || [];
      setTaxClasses(Array.isArray(classes) ? classes : []);
    } catch (err: any) {
      console.error('Error fetching tax classes:', err);
      // Don't show error - tax classes are optional
    }
  };

  // Filter products based on search query and status
  const filteredProducts = useMemo(() => {
    let filtered = products;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((product) => {
        const name = (product.name || '').toLowerCase();
        const sku = (product.sku || '').toLowerCase();
        const barcode = (product.barcode || '').toLowerCase();
        const description = (product.description || '').toLowerCase();
        return (
          name.includes(query) ||
          sku.includes(query) ||
          barcode.includes(query) ||
          description.includes(query)
        );
      });
    }

    // Status filter
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter((product) => product.status === statusFilter);
    }

    return filtered;
  }, [products, searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredProducts.slice(start, start + PAGE_SIZE);
  }, [filteredProducts, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleEditPricing = (product: any) => {
    setSelectedProduct(product);
    setPricingData({
      price: product.price?.toString() || '',
      tradePrice: product.tradePrice?.toString() || '',
      rrp: product.rrp?.toString() || '',
      stock: product.stock?.toString() || '0',
      taxClassId: product.taxClassId || '',
      taxRate: product.taxRate != null ? String(Number(product.taxRate)) : '',
      currency: product.currency || 'USD',
    });
    setShowPricingModal(true);
  };

  // Get display name for tax class with rate info
  const getTaxClassDisplay = (taxClassId: string | undefined) => {
    if (!taxClassId) return 'Not set';
    const taxClass = taxClasses.find(tc => tc.id === taxClassId);
    if (!taxClass) return 'Unknown';
    // Show first rate if available
    const rate = taxClass.rates?.[0]?.rate;
    return rate !== undefined ? `${taxClass.name} (${(Number(rate) * 100).toFixed(0)}%)` : taxClass.name;
  };

  const handleUpdatePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    const price = parseFloat(pricingData.price);
    if (isNaN(price) || price < 0) {
      toast.error('Please enter a valid price');
      return;
    }

    try {
      setUpdating(true);
      await apiClient.updateAdminProduct(selectedProduct.id, {
        price,
        tradePrice: pricingData.tradePrice ? parseFloat(pricingData.tradePrice) : undefined,
        rrp: pricingData.rrp ? parseFloat(pricingData.rrp) : undefined,
        stock: parseInt(pricingData.stock, 10) || 0,
        ...(pricingData.taxClassId ? { taxClassId: pricingData.taxClassId } : {}),
        ...(pricingData.taxRate !== '' ? { taxRate: parseFloat(pricingData.taxRate) } : {}),
        // Note: currency is managed at platform/tenant level, not per-product
      });
      toast.success('Pricing updated successfully');
      setShowPricingModal(false);
      setSelectedProduct(null);
      fetchProducts();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update pricing');
    } finally {
      setUpdating(false);
    }
  };

  const handleActivateProduct = async (product: any) => {
    if (!product.price || product.price === 0) {
      toast.error('Product must have a price before activation');
      return;
    }

    try {
      await apiClient.updateAdminProduct(product.id, {
        status: 'ACTIVE',
      });
      toast.success('Product activated successfully');
      fetchProducts();
    } catch (err: any) {
      toast.error(err.message || 'Failed to activate product');
    }
  };

  return (
    <RouteGuard allowedRoles={['ADMIN', 'FINANCE']} showAccessDenied={true}>
              <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-hos-text-secondary">Price Management</h1>
              <p className="text-hos-text-secondary mt-2">Manage product pricing, stock, and tax information. Products must be created first.</p>
            </div>
            <button
              onClick={() => router.push('/admin/products')}
              className="px-4 py-2 bg-hos-bg-tertiary text-hos-text-secondary rounded-lg hover:bg-hos-text-muted"
            >
              Back to Products
            </button>
          </div>

          {/* Search and Filters */}
          <div className="bg-hos-bg-secondary rounded-lg shadow p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search by name, SKU, or barcode..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 focus:border-transparent"
                  />
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-hos-text-muted">
                    🔍
                  </span>
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-hos-text-muted hover:text-hos-text-secondary"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
              <div className="sm:w-48">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="DRAFT">Draft Only</option>
                  <option value="ACTIVE">Active Only</option>
                  <option value="INACTIVE">Inactive Only</option>
                </select>
              </div>
            </div>
            {(searchQuery || statusFilter !== 'ALL') && (
              <div className="mt-3 flex items-center justify-between text-sm text-hos-text-secondary">
                <span>
                  Showing {filteredProducts.length} of {products.length} products
                </span>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('ALL');
                  }}
                  className="text-hos-gold hover:text-hos-gold-hover font-medium"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>

          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-hos-gold"></div>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-300">Error: {error}</p>
              <button
                onClick={fetchProducts}
                className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && (
            <div className="bg-hos-bg-secondary rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-hos-border">
                <thead className="bg-hos-bg-secondary">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                      Current Price
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                      Stock
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                      Tax Class
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-hos-bg-secondary divide-y divide-hos-border">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 text-center text-hos-text-muted">
                        {searchQuery || statusFilter !== 'ALL'
                          ? 'No products match your search criteria'
                          : 'No products found'}
                      </td>
                    </tr>
                  ) : (
                    paginatedProducts.map((product) => (
                      <tr key={product.id} className="hover:bg-hos-bg-tertiary">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-hos-text-secondary">
                            {product.name}
                          </div>
                          <div className="text-sm text-hos-text-muted">{product.sku || 'No SKU'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-hos-text-secondary">
                          {product.currency || 'USD'} {Number(product.price || 0).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-hos-text-secondary">
                          {product.stock || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-hos-text-secondary">
                          {product.taxClassId
                            ? getTaxClassDisplay(product.taxClassId)
                            : product.taxRate != null
                              ? `${(Number(product.taxRate) * 100).toFixed(0)}% (override)`
                              : getTaxClassDisplay(undefined)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              product.status === 'ACTIVE'
                                ? 'bg-green-500/15 text-green-300'
                                : product.status === 'DRAFT'
                                ? 'bg-yellow-500/15 text-yellow-300'
                                : 'bg-hos-bg-tertiary text-hos-text-secondary'
                            }`}
                          >
                            {product.status || 'UNKNOWN'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleEditPricing(product)}
                              className="text-hos-gold hover:text-hos-gold px-2 py-1 rounded hover:bg-hos-gold/10 transition-colors"
                            >
                              Edit Pricing
                            </button>
                            {product.status === 'DRAFT' && product.price > 0 && (
                              <button
                                onClick={() => handleActivateProduct(product)}
                                className="text-green-400 hover:text-green-300 px-2 py-1 rounded hover:bg-green-500/10 transition-colors"
                              >
                                Activate
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            {filteredProducts.length > PAGE_SIZE && (
              <div className="flex items-center justify-between px-6 py-3 border-t border-hos-border">
                <p className="text-sm text-hos-text-muted">
                  Page {currentPage} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 text-sm font-medium border border-hos-border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-hos-bg-tertiary"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 text-sm font-medium border border-hos-border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-hos-bg-tertiary"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
            </div>
          )}

          {/* Pricing Modal */}
          {showPricingModal && selectedProduct && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
              <div className="bg-hos-bg-secondary rounded-lg max-w-2xl w-full my-4">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h2 className="text-2xl font-bold">Manage Pricing</h2>
                      <p className="text-sm text-hos-text-secondary mt-1">{selectedProduct.name}</p>
                    </div>
                    <button
                      onClick={() => {
                        setShowPricingModal(false);
                        setSelectedProduct(null);
                      }}
                      className="text-hos-text-muted hover:text-hos-text-secondary"
                    >
                      ✕
                    </button>
                  </div>
                  <form onSubmit={handleUpdatePricing} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-hos-text-secondary mb-1">Price *</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          value={pricingData.price}
                          onChange={(e) => setPricingData({ ...pricingData, price: e.target.value })}
                          className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-hos-text-secondary mb-1">Currency</label>
                        <select
                          value={pricingData.currency}
                          onChange={(e) => setPricingData({ ...pricingData, currency: e.target.value })}
                          className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
                        >
                          <option value="USD">USD</option>
                          <option value="EUR">EUR</option>
                          <option value="AED">AED</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-hos-text-secondary mb-1">Trade Price</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={pricingData.tradePrice}
                          onChange={(e) => setPricingData({ ...pricingData, tradePrice: e.target.value })}
                          className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
                          placeholder="Wholesale price"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-hos-text-secondary mb-1">RRP (Recommended Retail Price)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={pricingData.rrp}
                          onChange={(e) => setPricingData({ ...pricingData, rrp: e.target.value })}
                          className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
                          placeholder="MSRP"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-hos-text-secondary mb-1">Stock *</label>
                        <input
                          type="number"
                          min="0"
                          required
                          value={pricingData.stock}
                          onChange={(e) => setPricingData({ ...pricingData, stock: e.target.value })}
                          className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-hos-text-secondary mb-1">Tax Class</label>
                        <select
                          value={pricingData.taxClassId}
                          onChange={(e) => setPricingData({ ...pricingData, taxClassId: e.target.value })}
                          className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
                        >
                          <option value="">No tax class (uses default rate)</option>
                          {taxClasses.map((tc) => {
                            const rate = tc.rates?.[0]?.rate;
                            const rateDisplay = rate !== undefined ? ` (${(Number(rate) * 100).toFixed(0)}%)` : '';
                            return (
                              <option key={tc.id} value={tc.id}>
                                {tc.name}{rateDisplay}
                              </option>
                            );
                          })}
                        </select>
                        {taxClasses.length === 0 && (
                          <p className="mt-1 text-xs text-hos-text-muted">
                            No tax classes configured. <a href="/admin/settings/integrations/tax" className="text-hos-gold hover:underline">Configure tax classes</a>
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-hos-text-secondary mb-1">Tax rate (optional override)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="1"
                          value={pricingData.taxRate}
                          onChange={(e) => setPricingData({ ...pricingData, taxRate: e.target.value })}
                          className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
                          placeholder="e.g. 0.2 for 20%"
                        />
                        <p className="mt-1 text-xs text-hos-text-muted">Decimal 0–1. Leave empty when using a tax class.</p>
                      </div>
                    </div>
                    <div className="flex gap-3 pt-4">
                      <button
                        type="submit"
                        disabled={updating}
                        className="flex-1 px-6 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors font-medium disabled:opacity-50"
                      >
                        {updating ? 'Updating...' : 'Update Pricing'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowPricingModal(false);
                          setSelectedProduct(null);
                        }}
                        className="px-6 py-2 bg-hos-bg-tertiary text-hos-text-secondary rounded-lg hover:bg-hos-text-muted transition-colors font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
          </RouteGuard>
  );
}
