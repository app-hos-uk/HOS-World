'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

interface ReturnPolicy {
  id: string;
  name: string;
  description: string | null;
  sellerId: string | null;
  productId: string | null;
  categoryId: string | null;
  isReturnable: boolean;
  returnWindowDays: number;
  requiresApproval: boolean;
  requiresInspection: boolean;
  refundMethod: string | null;
  restockingFee: number | null;
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const REFUND_METHODS = [
  'ORIGINAL_PAYMENT',
  'STORE_CREDIT',
  'EXCHANGE',
];

export default function AdminReturnPoliciesPage() {
  const toast = useToast();
  const [policies, setPolicies] = useState<ReturnPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<ReturnPolicy | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    sellerId: '',
    productId: '',
    categoryId: '',
    isReturnable: true,
    returnWindowDays: 30,
    requiresApproval: false,
    requiresInspection: false,
    refundMethod: 'ORIGINAL_PAYMENT',
    restockingFee: '',
    priority: 0,
    isActive: true,
  });

  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    sellerId: '',
    productId: '',
    categoryId: '',
    isReturnable: true,
    returnWindowDays: 30,
    requiresApproval: false,
    requiresInspection: false,
    refundMethod: 'ORIGINAL_PAYMENT',
    restockingFee: '',
    priority: 0,
    isActive: true,
  });

  useEffect(() => {
    fetchPolicies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getReturnPolicies();
      if (response?.data && Array.isArray(response.data)) {
        setPolicies(response.data);
      } else {
        setPolicies([]);
      }
    } catch (err: any) {
      console.error('Error fetching return policies:', err);
      setError(err.message || 'Failed to load return policies');
      toast.error(err.message || 'Failed to load return policies');
      setPolicies([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!createForm.name.trim()) {
      toast.error('Policy name is required');
      return;
    }

    // Validate scope: only one of sellerId, productId, categoryId should be set
    const scopeCount = [createForm.sellerId, createForm.productId, createForm.categoryId].filter(Boolean).length;
    if (scopeCount > 1) {
      toast.error('Policy can only be scoped to one of: seller, product, or category');
      return;
    }

    try {
      setActionLoading(true);
      await toast.promise(
        apiClient.createReturnPolicy({
          name: createForm.name.trim(),
          description: createForm.description.trim() || undefined,
          sellerId: createForm.sellerId.trim() || undefined,
          productId: createForm.productId.trim() || undefined,
          categoryId: createForm.categoryId.trim() || undefined,
          isReturnable: createForm.isReturnable,
          returnWindowDays: createForm.returnWindowDays,
          requiresApproval: createForm.requiresApproval,
          requiresInspection: createForm.requiresInspection,
          refundMethod: createForm.refundMethod,
          restockingFee: createForm.restockingFee ? parseFloat(createForm.restockingFee) : undefined,
          priority: createForm.priority,
          isActive: createForm.isActive,
        }),
        {
          loading: 'Creating return policy...',
          success: 'Return policy created successfully',
          error: (err: any) => err.message || 'Failed to create return policy',
        }
      );
      setShowCreateModal(false);
      setCreateForm({
        name: '',
        description: '',
        sellerId: '',
        productId: '',
        categoryId: '',
        isReturnable: true,
        returnWindowDays: 30,
        requiresApproval: false,
        requiresInspection: false,
        refundMethod: 'ORIGINAL_PAYMENT',
        restockingFee: '',
        priority: 0,
        isActive: true,
      });
      await fetchPolicies();
    } catch (err: any) {
      console.error('Error creating return policy:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEdit = (policy: ReturnPolicy) => {
    setSelectedPolicy(policy);
    setEditForm({
      name: policy.name,
      description: policy.description || '',
      sellerId: policy.sellerId || '',
      productId: policy.productId || '',
      categoryId: policy.categoryId || '',
      isReturnable: policy.isReturnable,
      returnWindowDays: policy.returnWindowDays,
      requiresApproval: policy.requiresApproval,
      requiresInspection: policy.requiresInspection,
      refundMethod: policy.refundMethod || 'ORIGINAL_PAYMENT',
      restockingFee: policy.restockingFee?.toString() || '',
      priority: policy.priority,
      isActive: policy.isActive,
    });
    setShowEditModal(true);
  };

  const handleUpdate = async () => {
    if (!selectedPolicy) return;

    if (!editForm.name.trim()) {
      toast.error('Policy name is required');
      return;
    }

    // Validate scope
    const scopeCount = [editForm.sellerId, editForm.productId, editForm.categoryId].filter(Boolean).length;
    if (scopeCount > 1) {
      toast.error('Policy can only be scoped to one of: seller, product, or category');
      return;
    }

    try {
      setActionLoading(true);
      await toast.promise(
        apiClient.updateReturnPolicy(selectedPolicy.id, {
          name: editForm.name.trim(),
          description: editForm.description.trim() || undefined,
          sellerId: editForm.sellerId.trim() || undefined,
          productId: editForm.productId.trim() || undefined,
          categoryId: editForm.categoryId.trim() || undefined,
          isReturnable: editForm.isReturnable,
          returnWindowDays: editForm.returnWindowDays,
          requiresApproval: editForm.requiresApproval,
          requiresInspection: editForm.requiresInspection,
          refundMethod: editForm.refundMethod,
          restockingFee: editForm.restockingFee ? parseFloat(editForm.restockingFee) : undefined,
          priority: editForm.priority,
          isActive: editForm.isActive,
        }),
        {
          loading: 'Updating return policy...',
          success: 'Return policy updated successfully',
          error: (err: any) => err.message || 'Failed to update return policy',
        }
      );
      setShowEditModal(false);
      await fetchPolicies();
    } catch (err: any) {
      console.error('Error updating return policy:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = (policy: ReturnPolicy) => {
    setSelectedPolicy(policy);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!selectedPolicy) return;

    try {
      setActionLoading(true);
      await toast.promise(
        apiClient.deleteReturnPolicy(selectedPolicy.id),
        {
          loading: 'Deleting return policy...',
          success: 'Return policy deleted successfully',
          error: (err: any) => err.message || 'Failed to delete return policy',
        }
      );
      setShowDeleteModal(false);
      await fetchPolicies();
    } catch (err: any) {
      console.error('Error deleting return policy:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const getScopeLabel = (policy: ReturnPolicy) => {
    if (policy.productId) return 'Product';
    if (policy.categoryId) return 'Category';
    if (policy.sellerId) return 'Seller';
    return 'Platform-wide';
  };

  return (
    <RouteGuard allowedRoles={['ADMIN', 'SELLER', 'B2C_SELLER']}>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Return Policies</h1>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors font-medium"
            >
              + Create Policy
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-hos-gold mx-auto mb-4"></div>
                <p className="text-sm text-hos-text-secondary">Loading return policies...</p>
              </div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">{error}</p>
            </div>
          ) : policies.length === 0 ? (
            <div className="bg-hos-bg-secondary rounded-lg p-8 text-center">
              <p className="text-hos-text-secondary mb-4">No return policies found.</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors font-medium"
              >
                Create First Policy
              </button>
            </div>
          ) : (
            <div className="bg-hos-bg-secondary border rounded-lg shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-hos-border">
                  <thead className="bg-hos-bg-secondary">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                        Scope
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                        Return Window
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                        Priority
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-hos-bg-secondary divide-y divide-hos-border">
                    {policies.map((policy) => (
                      <tr key={policy.id} className="hover:bg-hos-bg-tertiary">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-white">{policy.name}</div>
                          {policy.description && (
                            <div className="text-sm text-hos-text-muted">{policy.description}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-hos-gold/20 text-hos-gold">
                            {getScopeLabel(policy)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-hos-text-muted">
                          {policy.returnWindowDays} days
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-hos-text-muted">
                          {policy.priority}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${
                              policy.isActive
                                ? 'bg-green-100 text-green-800'
                                : 'bg-hos-bg-tertiary text-white'
                            }`}
                          >
                            {policy.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEdit(policy)}
                              className="text-hos-gold hover:text-hos-gold"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(policy)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Create Modal */}
          {showCreateModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
              <div className="bg-hos-bg-secondary rounded-lg max-w-2xl w-full p-6 my-8">
                <h2 className="text-xl font-bold mb-4">Create Return Policy</h2>
                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                  <div>
                    <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                      Name *
                    </label>
                    <input
                      type="text"
                      value={createForm.name}
                      onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-hos-gold/50 focus:border-hos-gold"
                      placeholder="e.g., Standard Return Policy"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                      Description
                    </label>
                    <textarea
                      value={createForm.description}
                      onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                      className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-hos-gold/50 focus:border-hos-gold"
                      rows={3}
                      placeholder="Policy description..."
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                        Seller ID (optional)
                      </label>
                      <input
                        type="text"
                        value={createForm.sellerId}
                        onChange={(e) => setCreateForm({ ...createForm, sellerId: e.target.value, productId: '', categoryId: '' })}
                        className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-hos-gold/50 focus:border-hos-gold"
                        placeholder="Seller UUID"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                        Product ID (optional)
                      </label>
                      <input
                        type="text"
                        value={createForm.productId}
                        onChange={(e) => setCreateForm({ ...createForm, productId: e.target.value, sellerId: '', categoryId: '' })}
                        className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-hos-gold/50 focus:border-hos-gold"
                        placeholder="Product UUID"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                        Category ID (optional)
                      </label>
                      <input
                        type="text"
                        value={createForm.categoryId}
                        onChange={(e) => setCreateForm({ ...createForm, categoryId: e.target.value, sellerId: '', productId: '' })}
                        className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-hos-gold/50 focus:border-hos-gold"
                        placeholder="Category UUID"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-hos-text-muted">Note: Only one scope (seller, product, or category) can be set. Leave all empty for platform-wide policy.</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                        Return Window (days) *
                      </label>
                      <input
                        type="number"
                        value={createForm.returnWindowDays}
                        onChange={(e) => setCreateForm({ ...createForm, returnWindowDays: parseInt(e.target.value) || 30 })}
                        className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-hos-gold/50 focus:border-hos-gold"
                        min="1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                        Priority
                      </label>
                      <input
                        type="number"
                        value={createForm.priority}
                        onChange={(e) => setCreateForm({ ...createForm, priority: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-hos-gold/50 focus:border-hos-gold"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                      Refund Method
                    </label>
                    <select
                      value={createForm.refundMethod}
                      onChange={(e) => setCreateForm({ ...createForm, refundMethod: e.target.value })}
                      className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-hos-gold/50 focus:border-hos-gold"
                    >
                      {REFUND_METHODS.map((method) => (
                        <option key={method} value={method}>
                          {method.replace('_', ' ')}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                      Restocking Fee (optional)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={createForm.restockingFee}
                      onChange={(e) => setCreateForm({ ...createForm, restockingFee: e.target.value })}
                      className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-hos-gold/50 focus:border-hos-gold"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={createForm.isReturnable}
                        onChange={(e) => setCreateForm({ ...createForm, isReturnable: e.target.checked })}
                        className="rounded border-hos-border text-hos-gold focus:ring-hos-gold/50"
                      />
                      <label className="text-sm text-hos-text-secondary">Items are returnable</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={createForm.requiresApproval}
                        onChange={(e) => setCreateForm({ ...createForm, requiresApproval: e.target.checked })}
                        className="rounded border-hos-border text-hos-gold focus:ring-hos-gold/50"
                      />
                      <label className="text-sm text-hos-text-secondary">Requires approval</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={createForm.requiresInspection}
                        onChange={(e) => setCreateForm({ ...createForm, requiresInspection: e.target.checked })}
                        className="rounded border-hos-border text-hos-gold focus:ring-hos-gold/50"
                      />
                      <label className="text-sm text-hos-text-secondary">Requires inspection</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={createForm.isActive}
                        onChange={(e) => setCreateForm({ ...createForm, isActive: e.target.checked })}
                        className="rounded border-hos-border text-hos-gold focus:ring-hos-gold/50"
                      />
                      <label className="text-sm text-hos-text-secondary">Active</label>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-4 py-2 border border-hos-border rounded-lg text-hos-text-secondary hover:bg-hos-bg-tertiary transition-colors"
                    disabled={actionLoading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={actionLoading}
                    className="flex-1 px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {actionLoading ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Edit Modal */}
          {showEditModal && selectedPolicy && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
              <div className="bg-hos-bg-secondary rounded-lg max-w-2xl w-full p-6 my-8">
                <h2 className="text-xl font-bold mb-4">Edit Return Policy</h2>
                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                  <div>
                    <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                      Name *
                    </label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-hos-gold/50 focus:border-hos-gold"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                      Description
                    </label>
                    <textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-hos-gold/50 focus:border-hos-gold"
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                        Seller ID (optional)
                      </label>
                      <input
                        type="text"
                        value={editForm.sellerId}
                        onChange={(e) => setEditForm({ ...editForm, sellerId: e.target.value, productId: '', categoryId: '' })}
                        className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-hos-gold/50 focus:border-hos-gold"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                        Product ID (optional)
                      </label>
                      <input
                        type="text"
                        value={editForm.productId}
                        onChange={(e) => setEditForm({ ...editForm, productId: e.target.value, sellerId: '', categoryId: '' })}
                        className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-hos-gold/50 focus:border-hos-gold"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                        Category ID (optional)
                      </label>
                      <input
                        type="text"
                        value={editForm.categoryId}
                        onChange={(e) => setEditForm({ ...editForm, categoryId: e.target.value, sellerId: '', productId: '' })}
                        className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-hos-gold/50 focus:border-hos-gold"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                        Return Window (days) *
                      </label>
                      <input
                        type="number"
                        value={editForm.returnWindowDays}
                        onChange={(e) => setEditForm({ ...editForm, returnWindowDays: parseInt(e.target.value) || 30 })}
                        className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-hos-gold/50 focus:border-hos-gold"
                        min="1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                        Priority
                      </label>
                      <input
                        type="number"
                        value={editForm.priority}
                        onChange={(e) => setEditForm({ ...editForm, priority: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-hos-gold/50 focus:border-hos-gold"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                      Refund Method
                    </label>
                    <select
                      value={editForm.refundMethod}
                      onChange={(e) => setEditForm({ ...editForm, refundMethod: e.target.value })}
                      className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-hos-gold/50 focus:border-hos-gold"
                    >
                      {REFUND_METHODS.map((method) => (
                        <option key={method} value={method}>
                          {method.replace('_', ' ')}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                      Restocking Fee (optional)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.restockingFee}
                      onChange={(e) => setEditForm({ ...editForm, restockingFee: e.target.value })}
                      className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-hos-gold/50 focus:border-hos-gold"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={editForm.isReturnable}
                        onChange={(e) => setEditForm({ ...editForm, isReturnable: e.target.checked })}
                        className="rounded border-hos-border text-hos-gold focus:ring-hos-gold/50"
                      />
                      <label className="text-sm text-hos-text-secondary">Items are returnable</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={editForm.requiresApproval}
                        onChange={(e) => setEditForm({ ...editForm, requiresApproval: e.target.checked })}
                        className="rounded border-hos-border text-hos-gold focus:ring-hos-gold/50"
                      />
                      <label className="text-sm text-hos-text-secondary">Requires approval</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={editForm.requiresInspection}
                        onChange={(e) => setEditForm({ ...editForm, requiresInspection: e.target.checked })}
                        className="rounded border-hos-border text-hos-gold focus:ring-hos-gold/50"
                      />
                      <label className="text-sm text-hos-text-secondary">Requires inspection</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={editForm.isActive}
                        onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                        className="rounded border-hos-border text-hos-gold focus:ring-hos-gold/50"
                      />
                      <label className="text-sm text-hos-text-secondary">Active</label>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="flex-1 px-4 py-2 border border-hos-border rounded-lg text-hos-text-secondary hover:bg-hos-bg-tertiary transition-colors"
                    disabled={actionLoading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdate}
                    disabled={actionLoading}
                    className="flex-1 px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {actionLoading ? 'Updating...' : 'Update'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Delete Modal */}
          {showDeleteModal && selectedPolicy && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-hos-bg-secondary rounded-lg max-w-md w-full p-6">
                <h2 className="text-xl font-bold mb-4">Delete Return Policy</h2>
                <p className="text-hos-text-secondary mb-6">
                  Are you sure you want to delete &quot;{selectedPolicy.name}&quot;? This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="flex-1 px-4 py-2 border border-hos-border rounded-lg text-hos-text-secondary hover:bg-hos-bg-tertiary transition-colors"
                    disabled={actionLoading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDelete}
                    disabled={actionLoading}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {actionLoading ? 'Deleting...' : 'Delete'}
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
