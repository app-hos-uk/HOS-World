'use client';

import { useEffect, useState, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

interface ChannelProduct {
  id: string;
  productId: string;
  productName?: string;
  channelType: string;
  currency: string;
  sellingPrice: number;
  costPrice?: number;
  compareAtPrice?: number;
  isActive?: boolean;
  product?: { name?: string; title?: string; sku?: string };
}

interface Store {
  id: string;
  name: string;
  code?: string;
}

export default function AdminChannelsPage() {
  const toast = useToast();

  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [channelProducts, setChannelProducts] = useState<ChannelProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [storesLoading, setStoresLoading] = useState(true);

  // Assign form state
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [assignLoading, setAssignLoading] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Record<string, unknown>[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Record<string, unknown> | null>(null);
  const [assignPrice, setAssignPrice] = useState('');
  const [assignCostPrice, setAssignCostPrice] = useState('');
  const [assignCompareAt, setAssignCompareAt] = useState('');
  const [assignCurrency, setAssignCurrency] = useState('USD');

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editCostPrice, setEditCostPrice] = useState('');
  const [editCompareAt, setEditCompareAt] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    setStoresLoading(true);
    apiClient
      .adminListStores()
      .then((r) => {
        const d = r.data as Store[] | undefined;
        setStores(Array.isArray(d) ? d : []);
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'Failed to load stores'))
      .finally(() => setStoresLoading(false));
  }, [toast]);

  const loadChannelProducts = useCallback(
    (storeId: string) => {
      if (!storeId) {
        setChannelProducts([]);
        return;
      }
      setLoading(true);
      apiClient
        .getStoreChannelProducts(storeId)
        .then((r) => {
          const d = r.data as ChannelProduct[] | undefined;
          setChannelProducts(Array.isArray(d) ? d : []);
        })
        .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'Failed to load channel products'))
        .finally(() => setLoading(false));
    },
    [toast],
  );

  useEffect(() => {
    if (selectedStoreId) {
      loadChannelProducts(selectedStoreId);
    } else {
      setChannelProducts([]);
    }
  }, [selectedStoreId, loadChannelProducts]);

  const handleSearch = useCallback(async () => {
    if (!productSearch.trim()) return;
    setSearching(true);
    try {
      const r = await apiClient.getAdminProducts({ search: productSearch.trim(), limit: 10 });
      const items = r.data as Record<string, unknown>[] | undefined;
      setSearchResults(Array.isArray(items) ? items : []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  }, [productSearch, toast]);

  const handleAssign = async () => {
    if (!selectedProduct || !selectedStoreId) return;
    const price = parseFloat(assignPrice);
    if (isNaN(price) || price < 0) {
      toast.error('Enter a valid selling price');
      return;
    }
    setAssignLoading(true);
    try {
      await apiClient.assignProductToChannel({
        productId: String(selectedProduct.id),
        channelType: 'STORE',
        storeId: selectedStoreId,
        currency: assignCurrency,
        sellingPrice: price,
        costPrice: assignCostPrice ? parseFloat(assignCostPrice) : undefined,
        compareAtPrice: assignCompareAt ? parseFloat(assignCompareAt) : undefined,
        isActive: true,
      });
      toast.success('Product assigned to channel');
      resetAssignForm();
      loadChannelProducts(selectedStoreId);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Assign failed');
    } finally {
      setAssignLoading(false);
    }
  };

  const resetAssignForm = () => {
    setShowAssignForm(false);
    setSelectedProduct(null);
    setProductSearch('');
    setSearchResults([]);
    setAssignPrice('');
    setAssignCostPrice('');
    setAssignCompareAt('');
    setAssignCurrency('USD');
  };

  const handleRemove = async (id: string) => {
    if (!confirm('Remove this product from the channel?')) return;
    try {
      await apiClient.removeProductFromChannel(id);
      toast.success('Product removed from channel');
      loadChannelProducts(selectedStoreId);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Remove failed');
    }
  };

  const startEdit = (item: ChannelProduct) => {
    setEditingId(item.id);
    setEditPrice(String(item.sellingPrice));
    setEditCostPrice(item.costPrice != null ? String(item.costPrice) : '');
    setEditCompareAt(item.compareAtPrice != null ? String(item.compareAtPrice) : '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditPrice('');
    setEditCostPrice('');
    setEditCompareAt('');
  };

  const handleSavePrice = async () => {
    if (!editingId) return;
    const price = parseFloat(editPrice);
    if (isNaN(price) || price < 0) {
      toast.error('Enter a valid selling price');
      return;
    }
    setEditSaving(true);
    try {
      await apiClient.updateChannelPrice(editingId, {
        sellingPrice: price,
        costPrice: editCostPrice ? parseFloat(editCostPrice) : undefined,
        compareAtPrice: editCompareAt ? parseFloat(editCompareAt) : undefined,
      });
      toast.success('Price updated');
      cancelEdit();
      loadChannelProducts(selectedStoreId);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setEditSaving(false);
    }
  };

  const getProductName = (item: ChannelProduct) =>
    item.productName || item.product?.name || item.product?.title || item.productId;

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-hos-text-secondary">Sales Channels</h1>
        </div>

        {/* Store Picker */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-hos-text-secondary mb-1">
            Select Store
          </label>
          {storesLoading ? (
            <p className="text-hos-text-muted text-sm">Loading stores…</p>
          ) : (
            <select
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              className="w-full max-w-md border border-hos-border rounded-lg px-3 py-2 bg-hos-bg-secondary text-hos-text-secondary text-sm focus:outline-none focus:ring-2 focus:ring-hos-gold"
            >
              <option value="">— Choose a store —</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.code ? `(${s.code})` : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        {selectedStoreId && (
          <>
            {/* Assign Button */}
            <div className="mb-4">
              <button
                onClick={() => setShowAssignForm((v) => !v)}
                className="text-sm rounded-md bg-hos-gold px-4 py-2 text-white font-medium hover:opacity-90 transition-opacity"
              >
                {showAssignForm ? 'Cancel' : '+ Assign Product'}
              </button>
            </div>

            {/* Assign Product Form */}
            {showAssignForm && (
              <div className="mb-6 border border-hos-border rounded-lg p-4 bg-hos-bg-secondary">
                <h2 className="text-sm font-semibold text-hos-text-secondary mb-3">
                  Assign Product to Channel
                </h2>

                {/* Product search */}
                <div className="mb-3">
                  <label className="block text-xs text-hos-text-muted mb-1">Search Products</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      placeholder="Search by name…"
                      className="flex-1 border border-hos-border rounded-md px-3 py-1.5 text-sm bg-transparent text-hos-text-secondary focus:outline-none focus:ring-2 focus:ring-hos-gold"
                    />
                    <button
                      onClick={handleSearch}
                      disabled={searching}
                      className="text-sm rounded-md bg-hos-gold px-3 py-1.5 text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {searching ? 'Searching…' : 'Search'}
                    </button>
                  </div>
                </div>

                {/* Search results */}
                {searchResults.length > 0 && !selectedProduct && (
                  <div className="mb-3 border border-hos-border rounded-md max-h-40 overflow-y-auto">
                    {searchResults.map((p) => (
                      <button
                        key={String(p.id)}
                        onClick={() => setSelectedProduct(p)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-hos-gold/10 text-hos-text-secondary border-b border-hos-border last:border-b-0"
                      >
                        {String(p.name || p.title || p.id)}
                        {p.sku ? (
                          <span className="ml-2 text-hos-text-muted text-xs">
                            SKU: {String(p.sku)}
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                )}

                {selectedProduct && (
                  <div className="mb-3 flex items-center gap-2 text-sm">
                    <span className="text-hos-text-secondary font-medium">
                      Selected: {String(selectedProduct.name || selectedProduct.title || selectedProduct.id)}
                    </span>
                    <button
                      onClick={() => {
                        setSelectedProduct(null);
                        setSearchResults([]);
                      }}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Change
                    </button>
                  </div>
                )}

                {/* Price fields */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-3">
                  <div>
                    <label className="block text-xs text-hos-text-muted mb-1">Currency</label>
                    <input
                      type="text"
                      value={assignCurrency}
                      onChange={(e) => setAssignCurrency(e.target.value.toUpperCase())}
                      maxLength={3}
                      className="w-full border border-hos-border rounded-md px-3 py-1.5 text-sm bg-transparent text-hos-text-secondary focus:outline-none focus:ring-2 focus:ring-hos-gold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-hos-text-muted mb-1">Selling Price *</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={assignPrice}
                      onChange={(e) => setAssignPrice(e.target.value)}
                      className="w-full border border-hos-border rounded-md px-3 py-1.5 text-sm bg-transparent text-hos-text-secondary focus:outline-none focus:ring-2 focus:ring-hos-gold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-hos-text-muted mb-1">Cost Price</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={assignCostPrice}
                      onChange={(e) => setAssignCostPrice(e.target.value)}
                      className="w-full border border-hos-border rounded-md px-3 py-1.5 text-sm bg-transparent text-hos-text-secondary focus:outline-none focus:ring-2 focus:ring-hos-gold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-hos-text-muted mb-1">Compare-At Price</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={assignCompareAt}
                      onChange={(e) => setAssignCompareAt(e.target.value)}
                      className="w-full border border-hos-border rounded-md px-3 py-1.5 text-sm bg-transparent text-hos-text-secondary focus:outline-none focus:ring-2 focus:ring-hos-gold"
                    />
                  </div>
                </div>

                <button
                  onClick={handleAssign}
                  disabled={!selectedProduct || assignLoading}
                  className="text-sm rounded-md bg-hos-gold px-4 py-2 text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {assignLoading ? 'Assigning…' : 'Assign to Channel'}
                </button>
              </div>
            )}

            {/* Channel Products Table */}
            {loading ? (
              <p className="text-hos-text-muted">Loading channel products…</p>
            ) : channelProducts.length === 0 ? (
              <p className="text-hos-text-muted text-sm">No products assigned to this store channel yet.</p>
            ) : (
              <div className="overflow-x-auto border border-hos-border rounded-lg">
                <table className="min-w-full text-sm">
                  <thead className="bg-hos-bg-secondary">
                    <tr>
                      <th className="text-left p-3 text-hos-text-muted font-medium">Product</th>
                      <th className="text-left p-3 text-hos-text-muted font-medium">Currency</th>
                      <th className="text-right p-3 text-hos-text-muted font-medium">Selling Price</th>
                      <th className="text-right p-3 text-hos-text-muted font-medium">Cost Price</th>
                      <th className="text-right p-3 text-hos-text-muted font-medium">Compare-At</th>
                      <th className="text-center p-3 text-hos-text-muted font-medium">Active</th>
                      <th className="text-right p-3 text-hos-text-muted font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {channelProducts.map((item) => (
                      <tr key={item.id} className="border-t border-hos-border">
                        {editingId === item.id ? (
                          <>
                            <td className="p-3 text-hos-text-secondary">{getProductName(item)}</td>
                            <td className="p-3 text-hos-text-secondary">{item.currency}</td>
                            <td className="p-3">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={editPrice}
                                onChange={(e) => setEditPrice(e.target.value)}
                                className="w-24 border border-hos-border rounded px-2 py-1 text-sm text-right bg-transparent text-hos-text-secondary focus:outline-none focus:ring-2 focus:ring-hos-gold"
                              />
                            </td>
                            <td className="p-3">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={editCostPrice}
                                onChange={(e) => setEditCostPrice(e.target.value)}
                                className="w-24 border border-hos-border rounded px-2 py-1 text-sm text-right bg-transparent text-hos-text-secondary focus:outline-none focus:ring-2 focus:ring-hos-gold"
                              />
                            </td>
                            <td className="p-3">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={editCompareAt}
                                onChange={(e) => setEditCompareAt(e.target.value)}
                                className="w-24 border border-hos-border rounded px-2 py-1 text-sm text-right bg-transparent text-hos-text-secondary focus:outline-none focus:ring-2 focus:ring-hos-gold"
                              />
                            </td>
                            <td className="p-3 text-center text-hos-text-secondary">
                              {item.isActive !== false ? 'Yes' : 'No'}
                            </td>
                            <td className="p-3 text-right space-x-2">
                              <button
                                onClick={handleSavePrice}
                                disabled={editSaving}
                                className="text-xs px-2 py-1 rounded bg-hos-gold text-white hover:opacity-90 disabled:opacity-50"
                              >
                                {editSaving ? 'Saving…' : 'Save'}
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="text-xs px-2 py-1 rounded border border-hos-border text-hos-text-muted hover:text-hos-text-secondary"
                              >
                                Cancel
                              </button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="p-3 text-hos-text-secondary">{getProductName(item)}</td>
                            <td className="p-3 text-hos-text-secondary">{item.currency}</td>
                            <td className="p-3 text-right text-hos-text-secondary">
                              {item.sellingPrice.toFixed(2)}
                            </td>
                            <td className="p-3 text-right text-hos-text-muted">
                              {item.costPrice != null ? item.costPrice.toFixed(2) : '—'}
                            </td>
                            <td className="p-3 text-right text-hos-text-muted">
                              {item.compareAtPrice != null ? item.compareAtPrice.toFixed(2) : '—'}
                            </td>
                            <td className="p-3 text-center">
                              <span
                                className={
                                  item.isActive !== false
                                    ? 'text-green-400 text-xs font-medium'
                                    : 'text-red-400 text-xs font-medium'
                                }
                              >
                                {item.isActive !== false ? 'Yes' : 'No'}
                              </span>
                            </td>
                            <td className="p-3 text-right space-x-2">
                              <button
                                onClick={() => startEdit(item)}
                                className="text-xs px-2 py-1 rounded border border-hos-gold text-hos-gold hover:bg-hos-gold/10"
                              >
                                Edit Price
                              </button>
                              <button
                                onClick={() => handleRemove(item.id)}
                                className="text-xs px-2 py-1 rounded border border-red-500 text-red-400 hover:bg-red-500/10"
                              >
                                Remove
                              </button>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </RouteGuard>
  );
}
