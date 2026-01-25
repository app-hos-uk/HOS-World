'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useCurrency } from '@/contexts/CurrencyContext';
import { DataExport } from '@/components/DataExport';

interface Product {
  id: string;
  name: string;
  sku?: string;
  price: number;
  tradePrice?: number;
  rrp?: number;
  originalPrice?: number;
  stock: number;
  currency: string;
  status: string;
  category?: { name: string };
  seller?: { storeName: string };
  taxRate?: number;
  margin?: number;
  createdAt: string | Date;
  updatedAt?: string | Date;
}

interface Stats {
  totalProducts: number;
  activeProducts: number;
  draftProducts: number;
  avgPrice: number;
  totalRevenuePotential: number;
  lowStockCount: number;
  outOfStockCount: number;
  belowRrpCount: number;
  noTaxRateCount: number;
}

interface PriceUpdate {
  id: string;
  field: 'price' | 'tradePrice' | 'stock' | 'taxRate';
  value: string;
}

export default function AdminPricingPage() {
  const toast = useToast();
  const { formatPrice } = useCurrency();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [updating, setUpdating] = useState(false);
  const [pendingUpdates, setPendingUpdates] = useState<Map<string, PriceUpdate>>(new Map());
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [stockFilter, setStockFilter] = useState<string>('ALL');
  const [priceFilter, setPriceFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'stock' | 'margin'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // Bulk update form
  const [bulkAction, setBulkAction] = useState<'price' | 'discount' | 'stock' | 'taxRate'>('price');
  const [bulkValue, setBulkValue] = useState('');
  const [bulkMode, setBulkMode] = useState<'set' | 'increase' | 'decrease' | 'percent'>('set');
  
  // Edit form
  const [editData, setEditData] = useState({
    price: '',
    tradePrice: '',
    rrp: '',
    stock: '',
    taxRate: '',
  });

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getAdminProducts({ page: 1, limit: 500 });
      const list = response?.data?.products || response?.data?.data || [];
      const productList = Array.isArray(list) ? list : [];
      
      // Calculate margins
      const withMargins = productList.map((p: Product) => ({
        ...p,
        margin: p.rrp && p.price ? ((p.rrp - p.price) / p.rrp * 100) : undefined,
      }));
      
      setProducts(withMargins);
      calculateStats(withMargins);
    } catch (err: any) {
      console.error('Error fetching products:', err);
      setError(err.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, []);

  const calculateStats = (productList: Product[]) => {
    const active = productList.filter(p => p.status === 'ACTIVE');
    const draft = productList.filter(p => p.status === 'DRAFT');
    const lowStock = productList.filter(p => p.stock > 0 && p.stock <= 10);
    const outOfStock = productList.filter(p => p.stock === 0);
    const belowRrp = productList.filter(p => p.rrp && p.price < p.rrp * 0.8);
    const noTax = productList.filter(p => !p.taxRate);
    
    const totalPrice = productList.reduce((sum, p) => sum + (p.price || 0), 0);
    const avgPrice = productList.length > 0 ? totalPrice / productList.length : 0;
    const revenuePotential = productList.reduce((sum, p) => sum + (p.price || 0) * (p.stock || 0), 0);

    setStats({
      totalProducts: productList.length,
      activeProducts: active.length,
      draftProducts: draft.length,
      avgPrice,
      totalRevenuePotential: revenuePotential,
      lowStockCount: lowStock.length,
      outOfStockCount: outOfStock.length,
      belowRrpCount: belowRrp.length,
      noTaxRateCount: noTax.length,
    });
  };

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Filtered and sorted products
  const filteredProducts = useMemo(() => {
    let filtered = [...products];

    // Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(term) ||
        p.sku?.toLowerCase().includes(term) ||
        p.category?.name?.toLowerCase().includes(term)
      );
    }

    // Status filter
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(p => p.status === statusFilter);
    }

    // Stock filter
    if (stockFilter === 'OUT') {
      filtered = filtered.filter(p => p.stock === 0);
    } else if (stockFilter === 'LOW') {
      filtered = filtered.filter(p => p.stock > 0 && p.stock <= 10);
    } else if (stockFilter === 'IN') {
      filtered = filtered.filter(p => p.stock > 10);
    }

    // Price filter
    if (priceFilter === 'NO_PRICE') {
      filtered = filtered.filter(p => !p.price || p.price === 0);
    } else if (priceFilter === 'BELOW_RRP') {
      filtered = filtered.filter(p => p.rrp && p.price < p.rrp * 0.8);
    } else if (priceFilter === 'NO_TAX') {
      filtered = filtered.filter(p => !p.taxRate);
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'price':
          comparison = (a.price || 0) - (b.price || 0);
          break;
        case 'stock':
          comparison = (a.stock || 0) - (b.stock || 0);
          break;
        case 'margin':
          comparison = (a.margin || 0) - (b.margin || 0);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [products, searchTerm, statusFilter, stockFilter, priceFilter, sortBy, sortOrder]);

  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product);
    setEditData({
      price: product.price?.toString() || '',
      tradePrice: product.tradePrice?.toString() || '',
      rrp: product.rrp?.toString() || '',
      stock: product.stock?.toString() || '0',
      taxRate: product.taxRate?.toString() || '',
    });
    setShowEditModal(true);
  };

  const handleSaveProduct = async () => {
    if (!selectedProduct) return;

    try {
      setUpdating(true);
      await apiClient.updateAdminProduct(selectedProduct.id, {
        price: parseFloat(editData.price) || 0,
        tradePrice: editData.tradePrice ? parseFloat(editData.tradePrice) : undefined,
        rrp: editData.rrp ? parseFloat(editData.rrp) : undefined,
        stock: parseInt(editData.stock, 10) || 0,
        taxRate: editData.taxRate ? parseFloat(editData.taxRate) : undefined,
      });
      toast.success('Product updated');
      setShowEditModal(false);
      setSelectedProduct(null);
      fetchProducts();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update');
    } finally {
      setUpdating(false);
    }
  };

  const handleBulkUpdate = async () => {
    if (selectedProducts.size === 0 || !bulkValue) return;

    const value = parseFloat(bulkValue);
    if (isNaN(value)) {
      toast.error('Please enter a valid number');
      return;
    }

    setUpdating(true);
    let success = 0;
    let failed = 0;

    for (const id of selectedProducts) {
      const product = products.find(p => p.id === id);
      if (!product) continue;

      try {
        let newValue: number;
        const currentValue = bulkAction === 'price' ? product.price :
                            bulkAction === 'stock' ? product.stock :
                            bulkAction === 'taxRate' ? (product.taxRate || 0) : product.price;

        switch (bulkMode) {
          case 'set':
            newValue = value;
            break;
          case 'increase':
            newValue = currentValue + value;
            break;
          case 'decrease':
            newValue = Math.max(0, currentValue - value);
            break;
          case 'percent':
            newValue = bulkAction === 'discount' 
              ? currentValue * (1 - value / 100)
              : currentValue * (1 + value / 100);
            break;
          default:
            newValue = value;
        }

        const updateData: any = {};
        if (bulkAction === 'price' || bulkAction === 'discount') {
          updateData.price = Math.round(newValue * 100) / 100;
        } else if (bulkAction === 'stock') {
          updateData.stock = Math.round(newValue);
        } else if (bulkAction === 'taxRate') {
          updateData.taxRate = newValue;
        }

        await apiClient.updateAdminProduct(id, updateData);
        success++;
      } catch {
        failed++;
      }
    }

    toast.success(`Updated ${success} products${failed > 0 ? `, ${failed} failed` : ''}`);
    setShowBulkModal(false);
    setSelectedProducts(new Set());
    setBulkValue('');
    setUpdating(false);
    fetchProducts();
  };

  const handleQuickUpdate = async (productId: string, field: string, value: string) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue) && value !== '') return;

    try {
      const updateData: any = {};
      if (field === 'price') updateData.price = numValue || 0;
      else if (field === 'stock') updateData.stock = Math.round(numValue) || 0;
      else if (field === 'taxRate') updateData.taxRate = numValue;

      await apiClient.updateAdminProduct(productId, updateData);
      fetchProducts();
    } catch (err: any) {
      toast.error('Failed to update');
    }
  };

  const toggleProductSelection = (id: string) => {
    setSelectedProducts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedProducts(new Set(filteredProducts.map(p => p.id)));
  };

  const clearSelection = () => {
    setSelectedProducts(new Set());
  };

  const getStockBadge = (stock: number) => {
    if (stock === 0) return <span className="px-2 py-0.5 text-xs rounded bg-red-100 text-red-700">Out of Stock</span>;
    if (stock <= 10) return <span className="px-2 py-0.5 text-xs rounded bg-yellow-100 text-yellow-700">Low Stock</span>;
    return <span className="px-2 py-0.5 text-xs rounded bg-green-100 text-green-700">In Stock</span>;
  };

  const getMarginBadge = (margin?: number) => {
    if (margin === undefined) return null;
    const color = margin >= 30 ? 'green' : margin >= 15 ? 'yellow' : 'red';
    return (
      <span className={`px-2 py-0.5 text-xs rounded bg-${color}-100 text-${color}-700`}>
        {margin.toFixed(1)}%
      </span>
    );
  };

  const exportColumns = [
    { key: 'name', header: 'Product Name' },
    { key: 'sku', header: 'SKU' },
    { key: 'price', header: 'Price', format: (v: number, r: Product) => `${r.currency || 'GBP'} ${Number(v || 0).toFixed(2)}` },
    { key: 'tradePrice', header: 'Trade Price', format: (v: number, r: Product) => v ? `${r.currency || 'GBP'} ${Number(v).toFixed(2)}` : '' },
    { key: 'rrp', header: 'RRP', format: (v: number, r: Product) => v ? `${r.currency || 'GBP'} ${Number(v).toFixed(2)}` : '' },
    { key: 'stock', header: 'Stock' },
    { key: 'taxRate', header: 'Tax Rate', format: (v: number) => v ? `${v}%` : '' },
    { key: 'status', header: 'Status' },
  ];

  if (loading) {
    return (
      <RouteGuard allowedRoles={['ADMIN', 'FINANCE']}>
        <AdminLayout>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        </AdminLayout>
      </RouteGuard>
    );
  }

  return (
    <RouteGuard allowedRoles={['ADMIN', 'FINANCE']}>
      <AdminLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Pricing Management</h1>
              <p className="text-gray-600 mt-1">Manage product pricing, stock, and tax rates</p>
            </div>
            <div className="flex gap-2">
              <DataExport 
                data={filteredProducts} 
                columns={exportColumns} 
                filename="pricing-export"
              />
            </div>
          </div>

          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-600">Total Products</p>
                <p className="text-2xl font-bold text-purple-600">{stats.totalProducts}</p>
                <p className="text-xs text-gray-500">{stats.activeProducts} active, {stats.draftProducts} draft</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-600">Average Price</p>
                <p className="text-2xl font-bold text-blue-600">{formatPrice(stats.avgPrice)}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-600">Revenue Potential</p>
                <p className="text-2xl font-bold text-green-600">{formatPrice(stats.totalRevenuePotential)}</p>
                <p className="text-xs text-gray-500">If all stock sold</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-600">Stock Alerts</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-lg font-bold text-red-600">{stats.outOfStockCount}</span>
                  <span className="text-xs text-gray-500">out</span>
                  <span className="text-lg font-bold text-yellow-600">{stats.lowStockCount}</span>
                  <span className="text-xs text-gray-500">low</span>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-600">Needs Attention</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-lg font-bold text-orange-600">{stats.noTaxRateCount}</span>
                  <span className="text-xs text-gray-500">no tax</span>
                  <span className="text-lg font-bold text-pink-600">{stats.belowRrpCount}</span>
                  <span className="text-xs text-gray-500">&lt;RRP</span>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">Error: {error}</p>
              <button onClick={fetchProducts} className="mt-2 text-red-600 hover:text-red-800 text-sm">
                Retry
              </button>
            </div>
          )}

          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[200px]">
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="DRAFT">Draft</option>
                <option value="INACTIVE">Inactive</option>
              </select>
              <select
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="ALL">All Stock</option>
                <option value="OUT">Out of Stock</option>
                <option value="LOW">Low Stock (≤10)</option>
                <option value="IN">In Stock (&gt;10)</option>
              </select>
              <select
                value={priceFilter}
                onChange={(e) => setPriceFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="ALL">All Prices</option>
                <option value="NO_PRICE">No Price Set</option>
                <option value="BELOW_RRP">Below 80% RRP</option>
                <option value="NO_TAX">No Tax Rate</option>
              </select>
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split('-');
                  setSortBy(field as any);
                  setSortOrder(order as any);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="name-asc">Name A-Z</option>
                <option value="name-desc">Name Z-A</option>
                <option value="price-asc">Price Low-High</option>
                <option value="price-desc">Price High-Low</option>
                <option value="stock-asc">Stock Low-High</option>
                <option value="stock-desc">Stock High-Low</option>
                <option value="margin-desc">Margin High-Low</option>
              </select>
            </div>

            {/* Bulk Actions */}
            {selectedProducts.size > 0 && (
              <div className="flex items-center gap-4 mt-4 pt-4 border-t">
                <span className="text-sm text-gray-600">{selectedProducts.size} selected</span>
                <button
                  onClick={() => setShowBulkModal(true)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Bulk Update
                </button>
                <button
                  onClick={clearSelection}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Clear Selection
                </button>
              </div>
            )}
          </div>

          {/* Products Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">Products ({filteredProducts.length})</h2>
              <button
                onClick={selectAllVisible}
                className="text-sm text-purple-600 hover:text-purple-800"
              >
                Select All Visible
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      <input
                        type="checkbox"
                        checked={selectedProducts.size === filteredProducts.length && filteredProducts.length > 0}
                        onChange={() => selectedProducts.size === filteredProducts.length ? clearSelection() : selectAllVisible()}
                        className="rounded border-gray-300 text-purple-600"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trade</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">RRP</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Margin</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tax</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                        No products found
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((product) => (
                      <tr key={product.id} className={`hover:bg-gray-50 ${selectedProducts.has(product.id) ? 'bg-purple-50' : ''}`}>
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedProducts.has(product.id)}
                            onChange={() => toggleProductSelection(product.id)}
                            className="rounded border-gray-300 text-purple-600"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-900 truncate max-w-[200px]">
                            {product.name}
                          </div>
                          <div className="text-xs text-gray-500">{product.sku || 'No SKU'}</div>
                          {product.category && (
                            <div className="text-xs text-gray-400">{product.category.name}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            step="0.01"
                            defaultValue={product.price || ''}
                            onBlur={(e) => handleQuickUpdate(product.id, 'price', e.target.value)}
                            className="w-24 px-2 py-1 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-purple-500"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {product.tradePrice ? formatPrice(product.tradePrice) : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {product.rrp ? formatPrice(product.rrp) : '-'}
                        </td>
                        <td className="px-4 py-3">
                          {product.margin !== undefined ? (
                            <span className={`text-sm font-medium ${
                              product.margin >= 30 ? 'text-green-600' :
                              product.margin >= 15 ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                              {product.margin.toFixed(1)}%
                            </span>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              defaultValue={product.stock || 0}
                              onBlur={(e) => handleQuickUpdate(product.id, 'stock', e.target.value)}
                              className="w-16 px-2 py-1 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-purple-500"
                            />
                            {getStockBadge(product.stock)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            step="0.01"
                            defaultValue={product.taxRate || ''}
                            onBlur={(e) => handleQuickUpdate(product.id, 'taxRate', e.target.value)}
                            className="w-16 px-2 py-1 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-purple-500"
                            placeholder="%"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 text-xs rounded ${
                            product.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                            product.status === 'DRAFT' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {product.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleEditProduct(product)}
                            className="text-purple-600 hover:text-purple-800 text-sm"
                          >
                            Edit All
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Edit Modal */}
          {showEditModal && selectedProduct && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Edit Pricing</h3>
                  <button onClick={() => setShowEditModal(false)} className="text-gray-500 hover:text-gray-700 text-2xl">
                    ×
                  </button>
                </div>
                <p className="text-sm text-gray-600 mb-4">{selectedProduct.name}</p>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Price *</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editData.price}
                        onChange={(e) => setEditData({ ...editData, price: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Trade Price</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editData.tradePrice}
                        onChange={(e) => setEditData({ ...editData, tradePrice: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">RRP</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editData.rrp}
                        onChange={(e) => setEditData({ ...editData, rrp: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Stock</label>
                      <input
                        type="number"
                        value={editData.stock}
                        onChange={(e) => setEditData({ ...editData, stock: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tax Rate (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editData.taxRate}
                      onChange={(e) => setEditData({ ...editData, taxRate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="e.g., 20"
                    />
                  </div>
                  <button
                    onClick={handleSaveProduct}
                    disabled={updating}
                    className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                  >
                    {updating ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Bulk Update Modal */}
          {showBulkModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Bulk Update ({selectedProducts.size} products)</h3>
                  <button onClick={() => setShowBulkModal(false)} className="text-gray-500 hover:text-gray-700 text-2xl">
                    ×
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">What to update</label>
                    <select
                      value={bulkAction}
                      onChange={(e) => setBulkAction(e.target.value as any)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="price">Price</option>
                      <option value="discount">Apply Discount</option>
                      <option value="stock">Stock</option>
                      <option value="taxRate">Tax Rate</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">How to update</label>
                    <select
                      value={bulkMode}
                      onChange={(e) => setBulkMode(e.target.value as any)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="set">Set to exact value</option>
                      <option value="increase">Increase by amount</option>
                      <option value="decrease">Decrease by amount</option>
                      <option value="percent">{bulkAction === 'discount' ? 'Discount by %' : 'Change by %'}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Value {bulkMode === 'percent' || bulkAction === 'discount' ? '(%)' : ''}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={bulkValue}
                      onChange={(e) => setBulkValue(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder={bulkMode === 'percent' ? '10' : '0.00'}
                    />
                  </div>
                  <button
                    onClick={handleBulkUpdate}
                    disabled={updating || !bulkValue}
                    className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                  >
                    {updating ? 'Updating...' : 'Apply to Selected'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
