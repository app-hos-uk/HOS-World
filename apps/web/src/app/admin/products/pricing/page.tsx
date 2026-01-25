'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useRouter } from 'next/navigation';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [pricingData, setPricingData] = useState({
    price: '',
    tradePrice: '',
    rrp: '',
    stock: '0',
    taxRate: '',
    taxClassId: '',
    currency: 'GBP',
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getAdminProducts({ page: 1, limit: 100 });
      const list = response?.data?.products || response?.data?.data || [];
      setProducts(Array.isArray(list) ? list : []);
    } catch (err: any) {
      console.error('Error fetching products:', err);
      setError(err.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const handleEditPricing = (product: any) => {
    setSelectedProduct(product);
    setPricingData({
      price: product.price?.toString() || '',
      tradePrice: product.tradePrice?.toString() || '',
      rrp: product.rrp?.toString() || '',
      stock: product.stock?.toString() || '0',
      taxRate: product.taxRate?.toString() || '',
      taxClassId: product.taxClassId || '',
      currency: product.currency || 'GBP',
    });
    setShowPricingModal(true);
  };

  const handleUpdatePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    try {
      setUpdating(true);
      await apiClient.updateAdminProduct(selectedProduct.id, {
        price: parseFloat(pricingData.price),
        tradePrice: pricingData.tradePrice ? parseFloat(pricingData.tradePrice) : undefined,
        rrp: pricingData.rrp ? parseFloat(pricingData.rrp) : undefined,
        stock: parseInt(pricingData.stock, 10),
        taxRate: pricingData.taxRate ? parseFloat(pricingData.taxRate) : undefined,
        // Note: currency is managed at platform/tenant level, not per-product
      });
      toast.success('Pricing updated successfully');
      setShowPricingModal(false);
      setSelectedProduct(null);
      fetchProducts();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update pricing');
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
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Price Management</h1>
              <p className="text-gray-600 mt-2">Manage product pricing, stock, and tax information. Products must be created first.</p>
            </div>
            <button
              onClick={() => router.push('/admin/products')}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
            >
              Back to Products
            </button>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">Error: {error}</p>
              <button
                onClick={fetchProducts}
                className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Current Price
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stock
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tax Rate
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {products.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                        No products found
                      </td>
                    </tr>
                  ) : (
                    products.map((product) => (
                      <tr key={product.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">
                            {product.name}
                          </div>
                          <div className="text-sm text-gray-500">{product.sku || 'No SKU'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {product.currency || 'GBP'} {Number(product.price || 0).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {product.stock || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {product.taxRate ? `${product.taxRate}%` : 'Not set'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              product.status === 'ACTIVE'
                                ? 'bg-green-100 text-green-800'
                                : product.status === 'DRAFT'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {product.status || 'UNKNOWN'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleEditPricing(product)}
                              className="text-purple-600 hover:text-purple-900 px-2 py-1 rounded hover:bg-purple-50 transition-colors"
                            >
                              Edit Pricing
                            </button>
                            {product.status === 'DRAFT' && product.price > 0 && (
                              <button
                                onClick={() => handleActivateProduct(product)}
                                className="text-green-600 hover:text-green-900 px-2 py-1 rounded hover:bg-green-50 transition-colors"
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
            </div>
          )}

          {/* Pricing Modal */}
          {showPricingModal && selectedProduct && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
              <div className="bg-white rounded-lg max-w-2xl w-full my-4">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h2 className="text-2xl font-bold">Manage Pricing</h2>
                      <p className="text-sm text-gray-600 mt-1">{selectedProduct.name}</p>
                    </div>
                    <button
                      onClick={() => {
                        setShowPricingModal(false);
                        setSelectedProduct(null);
                      }}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      ✕
                    </button>
                  </div>
                  <form onSubmit={handleUpdatePricing} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Price *</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          value={pricingData.price}
                          onChange={(e) => setPricingData({ ...pricingData, price: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                        <select
                          value={pricingData.currency}
                          onChange={(e) => setPricingData({ ...pricingData, currency: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        >
                          <option value="GBP">GBP</option>
                          <option value="USD">USD</option>
                          <option value="EUR">EUR</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Trade Price</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={pricingData.tradePrice}
                          onChange={(e) => setPricingData({ ...pricingData, tradePrice: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                          placeholder="Wholesale price"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">RRP (Recommended Retail Price)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={pricingData.rrp}
                          onChange={(e) => setPricingData({ ...pricingData, rrp: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                          placeholder="MSRP"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Stock *</label>
                        <input
                          type="number"
                          min="0"
                          required
                          value={pricingData.stock}
                          onChange={(e) => setPricingData({ ...pricingData, stock: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tax Rate (%)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={pricingData.taxRate}
                          onChange={(e) => setPricingData({ ...pricingData, taxRate: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                          placeholder="20.00"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tax Class</label>
                      <select
                        value={pricingData.taxClassId}
                        onChange={(e) => setPricingData({ ...pricingData, taxClassId: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="">Select tax class</option>
                        <option value="STANDARD">Standard (20%)</option>
                        <option value="REDUCED">Reduced (5%)</option>
                        <option value="ZERO">Zero Rate (0%)</option>
                        <option value="EXEMPT">Exempt</option>
                      </select>
                    </div>
                    <div className="flex gap-3 pt-4">
                      <button
                        type="submit"
                        disabled={updating}
                        className="flex-1 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50"
                      >
                        {updating ? 'Updating...' : 'Update Pricing'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowPricingModal(false);
                          setSelectedProduct(null);
                        }}
                        className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors font-medium"
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
      </AdminLayout>
    </RouteGuard>
  );
}
