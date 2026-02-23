'use client';

import { useEffect, useState, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { DashboardLayout } from '@/components/DashboardLayout';
import { apiClient } from '@/lib/api';
import toast from 'react-hot-toast';

interface FulfillmentCenter {
  id: string;
  name: string;
  address: string;
  status: 'ACTIVE' | 'INACTIVE';
  capacity: number;
  createdAt?: string;
  updatedAt?: string;
}

interface CenterFormData {
  name: string;
  address: string;
  city: string;
  country: string;
  capacity: number;
}

const initialFormData: CenterFormData = { name: '', address: '', city: '', country: '', capacity: 0 };

export default function FulfillmentCentersPage() {
  const [centers, setCenters] = useState<FulfillmentCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingCenter, setEditingCenter] = useState<FulfillmentCenter | null>(null);
  const [formData, setFormData] = useState<CenterFormData>(initialFormData);
  const [actionLoading, setActionLoading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const menuItems = [
    { title: 'Dashboard', href: '/fulfillment/dashboard', icon: '📊' },
    { title: 'Manage Shipments', href: '/fulfillment/shipments', icon: '🚚' },
    { title: 'Centers', href: '/fulfillment/centers', icon: '🏭' },
  ];

  const fetchCenters = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
        setError(null);
      }
      const response = await apiClient.getFulfillmentCenters();
      if (response?.data) {
        setCenters(response.data);
      } else if (showLoading) {
        setError('Failed to load fulfillment centers');
      }
    } catch (err: any) {
      console.error('Error fetching fulfillment centers:', err);
      if (showLoading) setError(err.message || 'Failed to load fulfillment centers');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCenters(true);
  }, [fetchCenters]);

  const openAddModal = () => {
    setEditingCenter(null);
    setFormData(initialFormData);
    setShowModal(true);
  };

  const openEditModal = (center: FulfillmentCenter) => {
    setEditingCenter(center);
    setFormData({ name: center.name, address: center.address, city: (center as any).city || '', country: (center as any).country || '', capacity: center.capacity });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCenter(null);
    setFormData(initialFormData);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.address.trim() || !formData.city.trim() || !formData.country.trim()) {
      toast.error('Name, address, city, and country are required');
      return;
    }
    if (formData.capacity < 0) {
      toast.error('Capacity must be a positive number');
      return;
    }

    try {
      setActionLoading(true);
      if (editingCenter) {
        await apiClient.updateFulfillmentCenter(editingCenter.id, formData);
        toast.success('Center updated successfully');
      } else {
        await apiClient.createFulfillmentCenter(formData);
        toast.success('Center created successfully');
      }
      closeModal();
      await fetchCenters(false);
    } catch (err: any) {
      console.error('Error saving center:', err);
      toast.error(err.message || 'Failed to save center');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setActionLoading(true);
      await apiClient.deleteFulfillmentCenter(id);
      toast.success('Center deleted successfully');
      setDeleteConfirmId(null);
      await fetchCenters(false);
    } catch (err: any) {
      console.error('Error deleting center:', err);
      toast.error(err.message || 'Failed to delete center');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = async (center: FulfillmentCenter) => {
    const newActive = center.status !== 'ACTIVE';
    try {
      await apiClient.updateFulfillmentCenter(center.id, { isActive: newActive });
      toast.success(`Center ${newActive ? 'activated' : 'deactivated'}`);
      await fetchCenters(false);
    } catch (err: any) {
      console.error('Error toggling center status:', err);
      toast.error(err?.message || 'Failed to update center status');
    }
  };

  return (
    <RouteGuard allowedRoles={['FULFILLMENT', 'ADMIN']} showAccessDenied={true}>
      <DashboardLayout role="FULFILLMENT" menuItems={menuItems} title="Fulfillment">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Fulfillment Centers</h1>
            <p className="text-gray-600 mt-2">Manage your fulfillment center locations</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => fetchCenters(true)}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
            <button
              onClick={openAddModal}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
            >
              + Add Center
            </button>
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
          </div>
        )}

        {!loading && !error && centers.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
            <div className="text-5xl mb-4">🏭</div>
            <p className="text-gray-500 text-lg">No fulfillment centers found</p>
            <p className="text-sm text-gray-400 mt-2">Create your first center to get started</p>
            <button
              onClick={openAddModal}
              className="mt-4 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
            >
              + Add Center
            </button>
          </div>
        )}

        {!loading && !error && centers.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {centers.map((center) => (
              <div
                key={center.id}
                className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900 flex-1 mr-2">{center.name}</h3>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      center.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {center.status}
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="shrink-0">📍</span>
                    <span>{center.address}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="shrink-0">📦</span>
                    <span>Capacity: {center.capacity.toLocaleString()}</span>
                  </div>
                  {center.createdAt && (
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span>Created: {new Date(center.createdAt).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => handleToggleStatus(center)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      center.status === 'ACTIVE'
                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    {center.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => openEditModal(center)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                  >
                    Edit
                  </button>
                  {deleteConfirmId === center.id ? (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleDelete(center.id)}
                        disabled={actionLoading}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                      >
                        {actionLoading ? 'Deleting...' : 'Confirm'}
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirmId(center.id)}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-lg w-full">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-2xl font-bold">
                    {editingCenter ? 'Edit Center' : 'Add Fulfillment Center'}
                  </h2>
                  <button
                    onClick={closeModal}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Center Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="e.g. East Coast Warehouse"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Address <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Full address of the center"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">City <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="City"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Country <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={formData.country}
                        onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="Country"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Capacity
                    </label>
                    <input
                      type="number"
                      value={formData.capacity}
                      onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Max number of items"
                      min={0}
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50"
                    >
                      {actionLoading ? 'Saving...' : editingCenter ? 'Update Center' : 'Create Center'}
                    </button>
                    <button
                      type="button"
                      onClick={closeModal}
                      disabled={actionLoading}
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
      </DashboardLayout>
    </RouteGuard>
  );
}
