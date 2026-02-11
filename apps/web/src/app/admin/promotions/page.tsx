'use client';

import { useEffect, useState, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useCurrency } from '@/contexts/CurrencyContext';
import type { ApiResponse } from '@hos-marketplace/shared-types';

type PromotionType = 'PERCENTAGE_DISCOUNT' | 'FIXED_DISCOUNT' | 'BUY_X_GET_Y' | 'FREE_SHIPPING';
type RequirementType = 'MIN_ORDER_AMOUNT' | 'MIN_QUANTITY' | 'NONE';
type EligibilityType = 'ALL' | 'SPECIFIC_PRODUCTS' | 'SPECIFIC_CATEGORIES';

interface CategoryNode {
  id: string;
  name: string;
  slug?: string;
  parentId?: string | null;
  level?: number;
  path?: string;
  children?: CategoryNode[];
}

interface FlatCategory {
  id: string;
  name: string;
  path: string;
}

function flattenCategoryTree(nodes: CategoryNode[], pathPrefix = ''): FlatCategory[] {
  const result: FlatCategory[] = [];
  for (const node of nodes) {
    const path = pathPrefix ? `${pathPrefix} › ${node.name}` : node.name;
    result.push({ id: node.id, name: node.name, path });
    if (node.children && node.children.length > 0) {
      result.push(...flattenCategoryTree(node.children, path));
    }
  }
  return result;
}

const PROMO_TYPE_LABELS: Record<string, string> = {
  PERCENTAGE_DISCOUNT: 'Percentage',
  FIXED_DISCOUNT: 'Fixed',
  BUY_X_GET_Y: 'Buy X Get Y',
  FREE_SHIPPING: 'Free Shipping',
  PRODUCT_DISCOUNT: 'Product',
  CART_DISCOUNT: 'Cart',
};

function getPromoValueLabel(promo: any, formatPrice: (n: number) => string): string {
  const actions = promo.actions || {};
  if (promo.type === 'PERCENTAGE_DISCOUNT' && actions.percentage != null) return `${actions.percentage}%`;
  if (promo.type === 'FIXED_DISCOUNT' && actions.fixedAmount != null) return formatPrice(actions.fixedAmount);
  if (promo.type === 'BUY_X_GET_Y' && actions.buyQuantity != null && actions.getQuantity != null) {
    return `Buy ${actions.buyQuantity} Get ${actions.getQuantity}`;
  }
  if (promo.type === 'FREE_SHIPPING') return 'Free shipping';
  return '—';
}

function getConditionsSummary(conditions: any): string {
  if (!conditions) return '—';
  const rt = conditions.requirementType;
  if (rt === 'MIN_ORDER_AMOUNT' && conditions.cartValue?.min != null) {
    return `Min order ${conditions.cartValue.min}`;
  }
  if (rt === 'MIN_QUANTITY' && conditions.minQuantity != null) {
    return `Min ${conditions.minQuantity} items`;
  }
  if (rt === 'NONE') return 'No minimum';
  if (conditions.cartValue?.min != null) return `Min order ${conditions.cartValue.min}`;
  if (conditions.minQuantity != null) return `Min ${conditions.minQuantity} items`;
  return '—';
}

function getEligibilitySummary(promo: any): string {
  const conditions = promo.conditions || {};
  const et = conditions.eligibilityType;
  if (et === 'SPECIFIC_PRODUCTS' && conditions.productIds?.length) {
    return `${conditions.productIds.length} product(s)`;
  }
  if (et === 'SPECIFIC_CATEGORIES' && conditions.categoryIds?.length) {
    return `${conditions.categoryIds.length} category(ies)`;
  }
  return 'All';
}

function getUsageSummary(promo: any): string {
  const count = promo.usageCount ?? 0;
  const limit = promo.usageLimit;
  if (limit != null) return `${count}/${limit}`;
  return 'Unlimited';
}

export default function AdminPromotionsPage() {
  const toast = useToast();
  const { formatPrice } = useCurrency();
  const [promotions, setPromotions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingPromotion, setCreatingPromotion] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [productSearchResults, setProductSearchResults] = useState<any[]>([]);
  const [productSearching, setProductSearching] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<{ id: string; name: string }[]>([]);
  const [categoryTree, setCategoryTree] = useState<CategoryNode[]>([]);
  const [categorySearchTerm, setCategorySearchTerm] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'PERCENTAGE_DISCOUNT' as PromotionType,
    percentage: 0,
    fixedAmount: 0,
    buyQuantity: 2,
    getQuantity: 1,
    startDate: '',
    endDate: '',
    status: 'ACTIVE' as 'ACTIVE' | 'DRAFT',
    isStackable: false,
    requirementType: 'NONE' as RequirementType,
    minOrderAmount: 0,
    minQuantity: 0,
    eligibilityType: 'ALL' as EligibilityType,
    productIds: [] as string[],
    categoryIds: [] as string[],
    totalLimitEnabled: false,
    totalLimitValue: 100,
    perCustomerEnabled: false,
    userUsageLimit: 1,
  });

  useEffect(() => {
    fetchPromotions();
  }, []);

  const fetchPromotions = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getPromotions({ activeOnly: false });
      if (response?.data && Array.isArray(response.data)) {
        setPromotions(response.data);
      } else {
        setPromotions([]);
      }
    } catch (err: any) {
      console.error('Error fetching promotions:', err);
      toast.error(err.message || 'Failed to load promotions');
      setPromotions([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategoryTree = useCallback(async () => {
    try {
      const response = await apiClient.getCategoryTree();
      const data = response?.data;
      setCategoryTree(Array.isArray(data) ? data : []);
    } catch {
      setCategoryTree([]);
    }
  }, []);

  useEffect(() => {
    if (showCreateModal && formData.eligibilityType === 'SPECIFIC_CATEGORIES') {
      fetchCategoryTree();
    }
  }, [showCreateModal, formData.eligibilityType, fetchCategoryTree]);

  const debouncedProductSearch = useCallback(() => {
    if (!productSearchTerm.trim()) {
      setProductSearchResults([]);
      return;
    }
    let cancelled = false;
    setProductSearching(true);
    apiClient
      .getProducts({ query: productSearchTerm.trim(), limit: 20 })
      .then((res) => {
        if (cancelled) return;
        const list = (res?.data as any)?.data ?? res?.data ?? [];
        setProductSearchResults(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setProductSearchResults([]);
      })
      .finally(() => {
        if (!cancelled) setProductSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productSearchTerm]);

  useEffect(() => {
    const t = setTimeout(debouncedProductSearch, 300);
    return () => clearTimeout(t);
  }, [productSearchTerm, debouncedProductSearch]);

  const flatCategories = categoryTree.length ? flattenCategoryTree(categoryTree) : [];
  const filteredCategories = categorySearchTerm.trim()
    ? flatCategories.filter(
        (c) =>
          c.name.toLowerCase().includes(categorySearchTerm.toLowerCase()) ||
          c.path.toLowerCase().includes(categorySearchTerm.toLowerCase())
      )
    : flatCategories;

  const addProduct = (p: any) => {
    if (!p?.id || formData.productIds.includes(p.id)) return;
    setFormData((prev) => ({ ...prev, productIds: [...prev.productIds, p.id] }));
    setSelectedProducts((prev) => [...prev, { id: p.id, name: p.name ?? p.title ?? p.id }]);
  };
  const removeProduct = (id: string) => {
    setFormData((prev) => ({ ...prev, productIds: prev.productIds.filter((x) => x !== id) }));
    setSelectedProducts((prev) => prev.filter((x) => x.id !== id));
  };
  const addCategory = (id: string) => {
    if (formData.categoryIds.includes(id)) return;
    setFormData((prev) => ({ ...prev, categoryIds: [...prev.categoryIds, id] }));
  };
  const removeCategory = (id: string) => {
    setFormData((prev) => ({ ...prev, categoryIds: prev.categoryIds.filter((x) => x !== id) }));
  };

  const handleCreatePromotion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creatingPromotion) return;

    const startTrimmed = formData.startDate?.trim() ?? '';
    if (!startTrimmed) {
      toast.error('Start date is required');
      return;
    }
    // Parse as UTC midnight so the same calendar date is sent to the backend regardless of user timezone (avoids e.g. UTC+5 Feb 15 becoming Feb 14 19:00 UTC)
    const startDateObj = new Date(startTrimmed + 'T00:00:00.000Z');
    if (Number.isNaN(startDateObj.getTime())) {
      toast.error('Start date is invalid');
      return;
    }

    const d = new Date();
    const todayUtc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    if (startDateObj < todayUtc) {
      toast.error('Start date cannot be in the past');
      return;
    }
    if (formData.endDate) {
      const endTrimmed = formData.endDate.trim();
      const endDateObj = new Date(endTrimmed + 'T00:00:00.000Z');
      if (Number.isNaN(endDateObj.getTime())) {
        toast.error('End date is invalid');
        return;
      }
      if (endDateObj < todayUtc) {
        toast.error('End date cannot be in the past');
        return;
      }
      if (endDateObj <= startDateObj) {
        toast.error('End date must be after start date');
        return;
      }
    }

    const requirementType = formData.requirementType;
    const eligibilityType = formData.eligibilityType;

    const conditions: any = {
      requirementType,
      eligibilityType,
      cartValue: requirementType === 'MIN_ORDER_AMOUNT' && formData.minOrderAmount > 0 ? { min: formData.minOrderAmount } : undefined,
      minQuantity: requirementType === 'MIN_QUANTITY' && formData.minQuantity > 0 ? formData.minQuantity : undefined,
      productIds: eligibilityType === 'SPECIFIC_PRODUCTS' && formData.productIds.length ? formData.productIds : undefined,
      categoryIds: eligibilityType === 'SPECIFIC_CATEGORIES' && formData.categoryIds.length ? formData.categoryIds : undefined,
    };

    const actions: any = {
      type: formData.type,
      percentage: formData.type === 'PERCENTAGE_DISCOUNT' ? formData.percentage : undefined,
      fixedAmount: formData.type === 'FIXED_DISCOUNT' ? formData.fixedAmount : undefined,
      buyQuantity: formData.type === 'BUY_X_GET_Y' ? formData.buyQuantity : undefined,
      getQuantity: formData.type === 'BUY_X_GET_Y' ? formData.getQuantity : undefined,
      freeShipping: formData.type === 'FREE_SHIPPING' ? true : undefined,
    };

    const promotionPayload = {
      name: formData.name,
      description: formData.description || undefined,
      type: formData.type,
      status: formData.status,
      startDate: startDateObj.toISOString(),
      endDate: formData.endDate ? new Date(formData.endDate.trim() + 'T00:00:00.000Z').toISOString() : undefined,
      isStackable: formData.isStackable,
      usageLimit: formData.totalLimitEnabled ? formData.totalLimitValue : undefined,
      userUsageLimit: formData.perCustomerEnabled ? (formData.userUsageLimit || 1) : undefined,
      conditions,
      actions,
    };

    try {
      setCreatingPromotion(true);
      await apiClient.post<ApiResponse<any>>('/promotions', promotionPayload);
      toast.success('Promotion created successfully!');
      setShowCreateModal(false);
      setSelectedProducts([]);
      setProductSearchTerm('');
      setProductSearchResults([]);
      setCategorySearchTerm('');
      setFormData({
        name: '',
        description: '',
        type: 'PERCENTAGE_DISCOUNT',
        percentage: 0,
        fixedAmount: 0,
        buyQuantity: 2,
        getQuantity: 1,
        startDate: '',
        endDate: '',
        status: 'ACTIVE',
        isStackable: false,
        requirementType: 'NONE',
        minOrderAmount: 0,
        minQuantity: 0,
        eligibilityType: 'ALL',
        productIds: [],
        categoryIds: [],
        totalLimitEnabled: false,
        totalLimitValue: 100,
        perCustomerEnabled: false,
        userUsageLimit: 1,
      });
      fetchPromotions();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create promotion');
    } finally {
      setCreatingPromotion(false);
    }
  };

  const handleDeletePromotion = async (id: string) => {
    if (!confirm('Are you sure you want to delete this promotion?')) return;
    try {
      await apiClient.deletePromotion(id);
      toast.success('Promotion deleted successfully!');
      fetchPromotions();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete promotion');
    }
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']} showAccessDenied={true}>
      <AdminLayout>
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Promotions Management</h1>
              <p className="text-gray-600 mt-2">Create and manage promotional campaigns</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
            >
              + Create Promotion
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Conditions</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Eligibility</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usage</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dates</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {promotions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-4 text-center text-gray-500">
                      No promotions found. Create your first promotion above.
                    </td>
                  </tr>
                ) : (
                  promotions.map((promo) => (
                    <tr key={promo.id}>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{promo.name}</div>
                        {promo.description && <div className="text-sm text-gray-500">{promo.description}</div>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {PROMO_TYPE_LABELS[promo.type] ?? promo.type}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {getPromoValueLabel(promo, formatPrice)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {getConditionsSummary(promo.conditions)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {getEligibilitySummary(promo)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {getUsageSummary(promo)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          promo.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {promo.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {promo.startDate && new Date(promo.startDate).toLocaleDateString()}
                        {promo.endDate ? ` – ${new Date(promo.endDate).toLocaleDateString()}` : ''}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleDeletePromotion(promo.id)}
                          className="text-red-600 hover:text-red-900 transition-colors"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <h2 className="text-2xl font-bold mb-4">Create New Promotion</h2>
                <form onSubmit={handleCreatePromotion} className="space-y-6">
                  {/* Section 1 - Basics */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-gray-700 border-b pb-1">Basics</h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={2}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                        <input
                          type="date"
                          value={formData.startDate}
                          onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                          min={new Date().toISOString().split('T')[0]}
                          required
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                        <input
                          type="date"
                          value={formData.endDate}
                          onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                          min={formData.startDate || new Date().toISOString().split('T')[0]}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="status"
                          checked={formData.status === 'ACTIVE'}
                          onChange={() => setFormData({ ...formData, status: 'ACTIVE' })}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">Active</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="status"
                          checked={formData.status === 'DRAFT'}
                          onChange={() => setFormData({ ...formData, status: 'DRAFT' })}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">Draft</span>
                      </label>
                      <label className="flex items-center ml-4">
                        <input
                          type="checkbox"
                          checked={formData.isStackable}
                          onChange={(e) => setFormData({ ...formData, isStackable: e.target.checked })}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">Stackable</span>
                      </label>
                    </div>
                  </div>

                  {/* Section 2 - Type + Value */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-gray-700 border-b pb-1">Promotion Type & Value</h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                      <select
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value as PromotionType })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        required
                      >
                        <option value="PERCENTAGE_DISCOUNT">Percentage Discount</option>
                        <option value="FIXED_DISCOUNT">Fixed Discount</option>
                        <option value="BUY_X_GET_Y">Buy X Get Y</option>
                        <option value="FREE_SHIPPING">Free Shipping</option>
                      </select>
                    </div>
                    {formData.type === 'PERCENTAGE_DISCOUNT' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Percentage *</label>
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          max={100}
                          value={formData.percentage}
                          onChange={(e) => setFormData({ ...formData, percentage: parseFloat(e.target.value) || 0 })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    )}
                    {formData.type === 'FIXED_DISCOUNT' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Fixed Amount *</label>
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          value={formData.fixedAmount}
                          onChange={(e) => setFormData({ ...formData, fixedAmount: parseFloat(e.target.value) || 0 })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    )}
                    {formData.type === 'BUY_X_GET_Y' && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Buy quantity (X) *</label>
                          <input
                            type="number"
                            min={1}
                            value={formData.buyQuantity}
                            onChange={(e) => setFormData({ ...formData, buyQuantity: parseInt(e.target.value, 10) || 1 })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Get quantity (Y) *</label>
                          <input
                            type="number"
                            min={1}
                            value={formData.getQuantity}
                            onChange={(e) => setFormData({ ...formData, getQuantity: parseInt(e.target.value, 10) || 1 })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Section 3 - Conditions */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-gray-700 border-b pb-1">Conditions</h3>
                    <div className="flex flex-col gap-2">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="requirementType"
                          checked={formData.requirementType === 'MIN_ORDER_AMOUNT'}
                          onChange={() => setFormData({ ...formData, requirementType: 'MIN_ORDER_AMOUNT' })}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">Minimum order amount</span>
                      </label>
                      {formData.requirementType === 'MIN_ORDER_AMOUNT' && (
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          value={formData.minOrderAmount}
                          onChange={(e) => setFormData({ ...formData, minOrderAmount: parseFloat(e.target.value) || 0 })}
                          placeholder="Amount"
                          className="w-full max-w-xs px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      )}
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="requirementType"
                          checked={formData.requirementType === 'MIN_QUANTITY'}
                          onChange={() => setFormData({ ...formData, requirementType: 'MIN_QUANTITY' })}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">Minimum quantity (items)</span>
                      </label>
                      {formData.requirementType === 'MIN_QUANTITY' && (
                        <input
                          type="number"
                          min={1}
                          value={formData.minQuantity}
                          onChange={(e) => setFormData({ ...formData, minQuantity: parseInt(e.target.value, 10) || 0 })}
                          placeholder="Quantity"
                          className="w-full max-w-xs px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      )}
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="requirementType"
                          checked={formData.requirementType === 'NONE'}
                          onChange={() => setFormData({ ...formData, requirementType: 'NONE' })}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">No minimum</span>
                      </label>
                    </div>
                  </div>

                  {/* Section 4 - Eligibility */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-gray-700 border-b pb-1">Eligibility</h3>
                    <div className="flex flex-col gap-2">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="eligibilityType"
                          checked={formData.eligibilityType === 'SPECIFIC_PRODUCTS'}
                          onChange={() => setFormData({ ...formData, eligibilityType: 'SPECIFIC_PRODUCTS' })}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">Specific products</span>
                      </label>
                      {formData.eligibilityType === 'SPECIFIC_PRODUCTS' && (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={productSearchTerm}
                            onChange={(e) => setProductSearchTerm(e.target.value)}
                            placeholder="Search products..."
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                          {productSearching && <p className="text-sm text-gray-500">Searching...</p>}
                          {productSearchResults.length > 0 && (
                            <ul className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
                              {productSearchResults.map((p) => (
                                <li key={p.id} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-0">
                                  <span className="text-sm truncate">{p.name ?? p.title}</span>
                                  <button
                                    type="button"
                                    onClick={() => addProduct(p)}
                                    disabled={formData.productIds.includes(p.id)}
                                    className="text-purple-600 text-sm font-medium disabled:opacity-50"
                                  >
                                    {formData.productIds.includes(p.id) ? 'Added' : 'Add'}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                          {selectedProducts.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {selectedProducts.map((sp) => (
                                <span
                                  key={sp.id}
                                  className="inline-flex items-center px-2 py-1 rounded-md bg-purple-100 text-purple-800 text-sm"
                                >
                                  {sp.name}
                                  <button type="button" onClick={() => removeProduct(sp.id)} className="ml-1 text-purple-600 hover:text-purple-800">&times;</button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="eligibilityType"
                          checked={formData.eligibilityType === 'SPECIFIC_CATEGORIES'}
                          onChange={() => setFormData({ ...formData, eligibilityType: 'SPECIFIC_CATEGORIES' })}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">Specific categories / collections</span>
                      </label>
                      {formData.eligibilityType === 'SPECIFIC_CATEGORIES' && (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={categorySearchTerm}
                            onChange={(e) => setCategorySearchTerm(e.target.value)}
                            placeholder="Search categories..."
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                          {filteredCategories.length > 0 && (
                            <ul className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
                              {filteredCategories.map((c) => (
                                <li key={c.id} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-0">
                                  <span className="text-sm truncate">{c.path}</span>
                                  <button
                                    type="button"
                                    onClick={() => addCategory(c.id)}
                                    disabled={formData.categoryIds.includes(c.id)}
                                    className="text-purple-600 text-sm font-medium disabled:opacity-50"
                                  >
                                    {formData.categoryIds.includes(c.id) ? 'Added' : 'Add'}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                          {formData.categoryIds.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {formData.categoryIds.map((id) => {
                                const c = flatCategories.find((x) => x.id === id);
                                return (
                                  <span
                                    key={id}
                                    className="inline-flex items-center px-2 py-1 rounded-md bg-purple-100 text-purple-800 text-sm"
                                  >
                                    {c?.name ?? id.slice(0, 8)}…
                                    <button type="button" onClick={() => removeCategory(id)} className="ml-1 text-purple-600 hover:text-purple-800">&times;</button>
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="eligibilityType"
                          checked={formData.eligibilityType === 'ALL'}
                          onChange={() => setFormData({ ...formData, eligibilityType: 'ALL' })}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">All products</span>
                      </label>
                    </div>
                  </div>

                  {/* Section 5 - Limitations */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-gray-700 border-b pb-1">Limitations / Usage</h3>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.totalLimitEnabled}
                        onChange={(e) => setFormData({ ...formData, totalLimitEnabled: e.target.checked })}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">Limit total uses</span>
                      {formData.totalLimitEnabled && (
                        <input
                          type="number"
                          min={1}
                          value={formData.totalLimitValue}
                          onChange={(e) => setFormData({ ...formData, totalLimitValue: parseInt(e.target.value, 10) || 1 })}
                          className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      )}
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.perCustomerEnabled}
                        onChange={(e) => setFormData({ ...formData, perCustomerEnabled: e.target.checked })}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">Limit to one use per customer</span>
                      {formData.perCustomerEnabled && (
                        <input
                          type="number"
                          min={1}
                          value={formData.userUsageLimit}
                          onChange={(e) => setFormData({ ...formData, userUsageLimit: parseInt(e.target.value, 10) || 1 })}
                          className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      )}
                    </label>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="submit"
                      disabled={creatingPromotion}
                      className="flex-1 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {creatingPromotion ? 'Creating...' : 'Create Promotion'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </AdminLayout>
    </RouteGuard>
  );
}
