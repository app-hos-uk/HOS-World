'use client';

import { useEffect, useState, Fragment } from 'react';
import { validateWarehouseForm } from '@/lib/warehouseFormValidation';
import {
  sanitizeLabelInput,
  sanitizePostalInput,
  isLabelInvalid,
  isPostalInvalid,
} from '@/lib/sellerProfileFieldValidation';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { Dialog, Transition } from '@headlessui/react';

interface Warehouse {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  state?: string;
  country: string;
  postalCode: string;
  latitude?: number;
  longitude?: number;
  contactEmail?: string;
  contactPhone?: string;
  managerName?: string;
  capacity?: number;
  warehouseType?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function AdminWarehousesPage() {
  const toast = useToast();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    address: '',
    city: '',
    state: '',
    country: '',
    postalCode: '',
    latitude: '',
    longitude: '',
    contactEmail: '',
    contactPhone: '',
    managerName: '',
    capacity: '',
    warehouseType: 'DISTRIBUTION',
    isActive: true,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchWarehouses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchWarehouses = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getWarehouses();
      if (response?.data && Array.isArray(response.data)) {
        setWarehouses(response.data);
      }
    } catch (err: any) {
      console.error('Error fetching warehouses:', err);
      setError(err.message || 'Failed to load warehouses');
      toast.error(err.message || 'Failed to load warehouses');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validateWarehouseForm({
      name: formData.name,
      city: formData.city,
      state: formData.state,
      country: formData.country,
      postalCode: formData.postalCode,
      contactPhone: formData.contactPhone,
      managerName: formData.managerName,
    });
    if (v) {
      toast.error(v);
      return;
    }
    if (!formData.code.trim()) {
      toast.error('Warehouse code is required');
      return;
    }
    if (!formData.address.trim()) {
      toast.error('Address is required');
      return;
    }
    try {
      setSubmitting(true);
      const payload = {
        name: formData.name,
        code: formData.code,
        address: formData.address,
        city: formData.city,
        state: formData.state || undefined,
        country: formData.country,
        postalCode: formData.postalCode,
        latitude: formData.latitude ? parseFloat(formData.latitude) : undefined,
        longitude: formData.longitude ? parseFloat(formData.longitude) : undefined,
        contactEmail: formData.contactEmail || undefined,
        contactPhone: formData.contactPhone || undefined,
        managerName: formData.managerName || undefined,
        capacity: formData.capacity ? parseInt(formData.capacity, 10) : undefined,
        warehouseType: formData.warehouseType || undefined,
        isActive: formData.isActive,
      };
      if (isEditMode && editingWarehouse) {
        await apiClient.updateWarehouse(editingWarehouse.id, payload);
        toast.success('Warehouse updated successfully!');
      } else {
        await apiClient.createWarehouse(payload);
        toast.success('Warehouse created successfully!');
      }
      setIsModalOpen(false);
      resetForm();
      fetchWarehouses();
    } catch (err: any) {
      console.error('Error saving warehouse:', err);
      toast.error(err.message || 'Failed to save warehouse');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (warehouse: Warehouse) => {
    setEditingWarehouse(warehouse);
    setIsEditMode(true);
    setFormData({
      name: warehouse.name,
      code: warehouse.code,
      address: warehouse.address,
      city: warehouse.city,
      state: warehouse.state || '',
      country: warehouse.country,
      postalCode: warehouse.postalCode,
      latitude: warehouse.latitude?.toString() || '',
      longitude: warehouse.longitude?.toString() || '',
      contactEmail: warehouse.contactEmail || '',
      contactPhone: warehouse.contactPhone || '',
      managerName: warehouse.managerName || '',
      capacity: warehouse.capacity?.toString() || '',
      warehouseType: warehouse.warehouseType || 'DISTRIBUTION',
      isActive: warehouse.isActive,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this warehouse? This action cannot be undone.')) {
      return;
    }
    try {
      await apiClient.deleteWarehouse(id);
      toast.success('Warehouse deleted successfully!');
      fetchWarehouses();
    } catch (err: any) {
      console.error('Error deleting warehouse:', err);
      toast.error(err.message || 'Failed to delete warehouse');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      address: '',
      city: '',
      state: '',
      country: '',
      postalCode: '',
      latitude: '',
      longitude: '',
      contactEmail: '',
      contactPhone: '',
      managerName: '',
      capacity: '',
      warehouseType: 'DISTRIBUTION',
      isActive: true,
    });
    setIsEditMode(false);
    setEditingWarehouse(null);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-hos-gold mb-2">Warehouse Management</h1>
              <p className="text-hos-text-secondary">Manage warehouses and inventory locations</p>
            </div>
            <button
              onClick={() => {
                resetForm();
                setIsModalOpen(true);
              }}
              className="bg-hos-gold hover:bg-hos-gold text-[#1a1406] px-6 py-2 rounded-lg font-medium transition-colors"
            >
              + Add Warehouse
            </button>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-hos-gold"></div>
              <p className="mt-4 text-hos-text-secondary">Loading warehouses...</p>
            </div>
          ) : (
            <div className="bg-hos-bg-secondary rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-hos-border">
                <thead className="bg-hos-bg-secondary">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                      Code
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                      Name / Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                      Coordinates
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                      Contact
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
                  {warehouses.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-hos-text-muted">
                        No warehouses found. Create your first warehouse to get started.
                      </td>
                    </tr>
                  ) : (
                    warehouses.map((warehouse) => (
                      <tr key={warehouse.id} className="hover:bg-hos-bg-tertiary">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="font-mono text-sm font-medium text-hos-gold">
                            {warehouse.code}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-white">{warehouse.name}</div>
                          {warehouse.warehouseType && (
                            <span className="text-xs px-1.5 py-0.5 bg-hos-bg-tertiary text-hos-text-secondary rounded">
                              {warehouse.warehouseType.replace('_', ' ')}
                            </span>
                          )}
                          {warehouse.capacity && (
                            <div className="text-xs text-hos-text-muted">Capacity: {warehouse.capacity}</div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-white">
                            {warehouse.city}, {warehouse.state || ''} {warehouse.country}
                          </div>
                          <div className="text-xs text-hos-text-muted">{warehouse.address}</div>
                          <div className="text-xs text-hos-text-muted">{warehouse.postalCode}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {warehouse.latitude != null && warehouse.longitude != null ? (
                            <div className="text-xs">
                              <div className="text-white">{Number(warehouse.latitude).toFixed(4)}</div>
                              <div className="text-hos-text-muted">{Number(warehouse.longitude).toFixed(4)}</div>
                            </div>
                          ) : (
                            <span className="text-xs text-hos-text-muted">Not set</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {warehouse.contactEmail || warehouse.contactPhone || warehouse.managerName ? (
                            <div className="text-xs">
                              {warehouse.managerName && <div className="text-white font-medium">{warehouse.managerName}</div>}
                              {warehouse.contactEmail && <div className="text-hos-text-secondary">{warehouse.contactEmail}</div>}
                              {warehouse.contactPhone && <div className="text-hos-text-muted">{warehouse.contactPhone}</div>}
                            </div>
                          ) : (
                            <span className="text-xs text-hos-text-muted">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              warehouse.isActive
                                ? 'bg-green-500/15 text-green-300'
                                : 'bg-hos-bg-tertiary text-white'
                            }`}
                          >
                            {warehouse.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => handleEdit(warehouse)}
                            className="text-hos-gold hover:text-hos-gold mr-3"
                          >
                            Edit
                          </button>
                          <Link
                            href={`/admin/warehouses/transfers?fromWarehouse=${warehouse.id}`}
                            className="text-hos-gold hover:text-hos-gold mr-3"
                          >
                            Transfers
                          </Link>
                          <button
                            onClick={() => handleDelete(warehouse.id)}
                            className="text-red-400 hover:text-red-300"
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

          {/* Create/Edit Modal */}
          <Transition appear show={isModalOpen} as={Fragment}>
            <Dialog as="div" className="relative z-10" onClose={handleCloseModal}>
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0"
                enterTo="opacity-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <div className="fixed inset-0 bg-black bg-opacity-25" />
              </Transition.Child>

              <div className="fixed inset-0 overflow-y-auto">
                <div className="flex min-h-full items-center justify-center p-4 text-center">
                  <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0 scale-95"
                    enterTo="opacity-100 scale-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100 scale-100"
                    leaveTo="opacity-0 scale-95"
                  >
                    <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-hos-bg-secondary p-6 text-left align-middle shadow-xl transition-all max-h-[90vh] overflow-y-auto">
                      <Dialog.Title
                        as="h3"
                        className="text-lg font-medium leading-6 text-white mb-4"
                      >
                        {isEditMode ? 'Edit Warehouse' : 'Create New Warehouse'}
                      </Dialog.Title>

                      <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                            Name *
                          </label>
                          <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: sanitizeLabelInput(e.target.value, formData.name) })}
                            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-hos-gold/50 ${isLabelInvalid(formData.name) ? 'border-red-500/40' : 'border-hos-border'}`}
                          />
                          {isLabelInvalid(formData.name) && (
                            <p className="text-xs text-red-400 mt-1">Must include at least one letter</p>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                            Code * (Unique)
                          </label>
                          <input
                            type="text"
                            required
                            disabled={isEditMode}
                            value={formData.code}
                            onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                            className="w-full px-3 py-2 border border-hos-border rounded-md focus:outline-none focus:ring-2 focus:ring-hos-gold/50 disabled:bg-hos-bg-tertiary"
                            placeholder="e.g., WH-LON-01"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                            Address *
                          </label>
                          <input
                            type="text"
                            required
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            className="w-full px-3 py-2 border border-hos-border rounded-md focus:outline-none focus:ring-2 focus:ring-hos-gold/50"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                              City *
                            </label>
                            <input
                              type="text"
                              required
                              value={formData.city}
                              onChange={(e) => setFormData({ ...formData, city: sanitizeLabelInput(e.target.value, formData.city) })}
                              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-hos-gold/50 ${isLabelInvalid(formData.city) ? 'border-red-500/40' : 'border-hos-border'}`}
                            />
                            {isLabelInvalid(formData.city) && (
                              <p className="text-xs text-red-400 mt-1">Must include at least one letter</p>
                            )}
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                              State/Region
                            </label>
                            <input
                              type="text"
                              value={formData.state}
                              onChange={(e) => setFormData({ ...formData, state: sanitizeLabelInput(e.target.value, formData.state) })}
                              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-hos-gold/50 ${isLabelInvalid(formData.state) ? 'border-red-500/40' : 'border-hos-border'}`}
                            />
                            {isLabelInvalid(formData.state) && (
                              <p className="text-xs text-red-400 mt-1">Must include at least one letter</p>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                              Country *
                            </label>
                            <input
                              type="text"
                              required
                              value={formData.country}
                              onChange={(e) => setFormData({ ...formData, country: sanitizeLabelInput(e.target.value, formData.country) })}
                              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-hos-gold/50 ${isLabelInvalid(formData.country) ? 'border-red-500/40' : 'border-hos-border'}`}
                              placeholder="e.g., GB, US"
                            />
                            {isLabelInvalid(formData.country) && (
                              <p className="text-xs text-red-400 mt-1">Must include at least one letter</p>
                            )}
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                              Postal Code *
                            </label>
                            <input
                              type="text"
                              required
                              value={formData.postalCode}
                              onChange={(e) => setFormData({ ...formData, postalCode: sanitizePostalInput(e.target.value) })}
                              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-hos-gold/50 ${isPostalInvalid(formData.postalCode) ? 'border-red-500/40' : 'border-hos-border'}`}
                            />
                            {isPostalInvalid(formData.postalCode) && (
                              <p className="text-xs text-red-400 mt-1">Must include at least one digit</p>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                              Latitude
                            </label>
                            <input
                              type="number"
                              step="any"
                              value={formData.latitude}
                              onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                              className="w-full px-3 py-2 border border-hos-border rounded-md focus:outline-none focus:ring-2 focus:ring-hos-gold/50"
                              placeholder="e.g., 51.5074"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                              Longitude
                            </label>
                            <input
                              type="number"
                              step="any"
                              value={formData.longitude}
                              onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                              className="w-full px-3 py-2 border border-hos-border rounded-md focus:outline-none focus:ring-2 focus:ring-hos-gold/50"
                              placeholder="e.g., -0.1278"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                              Contact Email
                            </label>
                            <input
                              type="email"
                              value={formData.contactEmail}
                              onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                              className="w-full px-3 py-2 border border-hos-border rounded-md focus:outline-none focus:ring-2 focus:ring-hos-gold/50"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                              Contact Phone
                            </label>
                            <input
                              type="tel"
                              value={formData.contactPhone}
                              onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                              className="w-full px-3 py-2 border border-hos-border rounded-md focus:outline-none focus:ring-2 focus:ring-hos-gold/50"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                              Manager Name
                            </label>
                            <input
                              type="text"
                              value={formData.managerName}
                              onChange={(e) => setFormData({ ...formData, managerName: sanitizeLabelInput(e.target.value, formData.managerName) })}
                              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-hos-gold/50 ${isLabelInvalid(formData.managerName) ? 'border-red-500/40' : 'border-hos-border'}`}
                            />
                            {isLabelInvalid(formData.managerName) && (
                              <p className="text-xs text-red-400 mt-1">Must include at least one letter</p>
                            )}
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                              Capacity (units)
                            </label>
                            <input
                              type="number"
                              value={formData.capacity}
                              onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                              className="w-full px-3 py-2 border border-hos-border rounded-md focus:outline-none focus:ring-2 focus:ring-hos-gold/50"
                              placeholder="Storage capacity"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                            Warehouse Type
                          </label>
                          <select
                            value={formData.warehouseType}
                            onChange={(e) => setFormData({ ...formData, warehouseType: e.target.value })}
                            className="w-full px-3 py-2 border border-hos-border rounded-md focus:outline-none focus:ring-2 focus:ring-hos-gold/50"
                          >
                            <option value="DISTRIBUTION">Distribution</option>
                            <option value="RETURNS">Returns Processing</option>
                            <option value="COLD_STORAGE">Cold Storage</option>
                            <option value="BULK">Bulk Storage</option>
                            <option value="CROSS_DOCK">Cross-Dock</option>
                          </select>
                        </div>

                        {isEditMode && (
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              id="isActive"
                              checked={formData.isActive}
                              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                              className="h-4 w-4 text-hos-gold focus:ring-hos-gold/50 border-hos-border rounded"
                            />
                            <label htmlFor="isActive" className="ml-2 block text-sm text-white">
                              Active
                            </label>
                          </div>
                        )}

                        <div className="flex justify-end space-x-3 mt-6">
                          <button
                            type="button"
                            onClick={handleCloseModal}
                            className="px-4 py-2 text-sm font-medium text-hos-text-secondary bg-hos-bg-secondary border border-hos-border rounded-md hover:bg-hos-bg-tertiary"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={submitting}
                            className="px-4 py-2 text-sm font-medium text-white bg-hos-gold rounded-md hover:bg-hos-gold-hover disabled:opacity-50"
                          >
                            {submitting ? 'Saving...' : isEditMode ? 'Update' : 'Create'}
                          </button>
                        </div>
                      </form>
                    </Dialog.Panel>
                  </Transition.Child>
                </div>
              </div>
            </Dialog>
          </Transition>
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
