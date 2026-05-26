'use client';

import { useEffect, useState, Fragment } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { Dialog, Transition } from '@headlessui/react';
import { validateFulfillmentCenterFields } from '@/lib/fulfillmentCenterFormValidation';
import {
  sanitizeLabelInput,
  sanitizePostalInput,
  isLabelInvalid,
  isPostalInvalid,
} from '@/lib/sellerProfileFieldValidation';

const emptyForm = () => ({
  name: '',
  address: '',
  city: '',
  country: '',
  postalCode: '',
  contactEmail: '',
  contactPhone: '',
  latitude: '',
  longitude: '',
  capacity: '',
  isActive: true,
});

export default function AdminFulfillmentCentersPage() {
  const toast = useToast();
  const [centers, setCenters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCenter, setEditingCenter] = useState<any | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCenters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchCenters = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getFulfillmentCenters();
      let centerData: any[] = [];
      if (response && 'data' in response) {
        const responseData = response.data as any;
        if (Array.isArray(responseData)) {
          centerData = responseData;
        } else if (responseData && typeof responseData === 'object' && 'data' in responseData && Array.isArray(responseData.data)) {
          centerData = responseData.data;
        }
      }
      setCenters(centerData);
    } catch (err: any) {
      console.error('Error fetching fulfillment centers:', err);
      setError(err.message || 'Failed to load fulfillment centers');
      setCenters([]);
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingCenter(null);
    setFormData(emptyForm());
    setIsModalOpen(true);
  };

  const openEditModal = (center: any) => {
    setEditingCenter(center);
    setFormData({
      name: center.name ?? '',
      address: center.address ?? '',
      city: center.city ?? '',
      country: center.country ?? '',
      postalCode: center.postalCode ?? '',
      contactEmail: center.contactEmail ?? '',
      contactPhone: center.contactPhone ?? '',
      latitude: center.latitude != null ? String(center.latitude) : '',
      longitude: center.longitude != null ? String(center.longitude) : '',
      capacity: center.capacity != null ? String(center.capacity) : '',
      isActive: center.isActive !== false,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCenter(null);
    setFormData(emptyForm());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.address.trim()) {
      toast.error('Address is required');
      return;
    }
    const fieldErr = validateFulfillmentCenterFields({
      name: formData.name,
      city: formData.city,
      country: formData.country,
      postalCode: formData.postalCode,
      contactPhone: formData.contactPhone,
    });
    if (fieldErr) {
      toast.error(fieldErr);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        address: formData.address.trim(),
        city: formData.city.trim(),
        country: formData.country.trim(),
        postalCode: formData.postalCode.trim() || undefined,
        contactEmail: formData.contactEmail.trim() || undefined,
        contactPhone: formData.contactPhone.trim() || undefined,
        latitude: formData.latitude ? parseFloat(formData.latitude) : undefined,
        longitude: formData.longitude ? parseFloat(formData.longitude) : undefined,
        capacity: formData.capacity ? parseInt(formData.capacity, 10) : undefined,
        isActive: formData.isActive,
      };

      let response: any;
      if (editingCenter?.id) {
        response = await apiClient.updateFulfillmentCenter(editingCenter.id, payload);
      } else {
        response = await apiClient.createFulfillmentCenter(payload);
      }

      if (response?.data) {
        toast.success(
          editingCenter
            ? 'Fulfillment center updated successfully!'
            : 'Fulfillment center created successfully!',
        );
        closeModal();
        fetchCenters();
      } else {
        toast.error(response?.message || 'Operation failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setSubmitting(true);
      await apiClient.deleteFulfillmentCenter(id);
      toast.success('Fulfillment center deleted');
      setDeleteConfirmId(null);
      fetchCenters();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete fulfillment center');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <RouteGuard allowedRoles={['ADMIN']}>
        <AdminLayout>
          <div className="flex items-center justify-center h-64">
            <div className="text-hos-text-muted">Loading fulfillment centers...</div>
          </div>
        </AdminLayout>
      </RouteGuard>
    );
  }

  if (error) {
    return (
      <RouteGuard allowedRoles={['ADMIN']}>
        <AdminLayout>
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <p className="text-red-300">Error: {error}</p>
            <button
              onClick={fetchCenters}
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </AdminLayout>
      </RouteGuard>
    );
  }

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-hos-text-secondary">Fulfillment Centers</h1>
            <button
              type="button"
              onClick={openAddModal}
              className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover"
            >
              Add Center
            </button>
          </div>

          <div className="bg-hos-bg-secondary rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-hos-border">
              <thead className="bg-hos-bg-secondary">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                    Name
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
                {centers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-hos-text-muted">
                      No fulfillment centers found
                    </td>
                  </tr>
                ) : (
                  centers.map((center) => (
                    <tr key={center.id} className="hover:bg-hos-bg-tertiary">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-hos-text-secondary">{center.name || 'N/A'}</div>
                        {center.capacity && (
                          <div className="text-xs text-hos-text-muted">Capacity: {center.capacity} units</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-hos-text-secondary">{center.city}, {center.country}</div>
                        <div className="text-xs text-hos-text-muted">{center.address}</div>
                        {center.postalCode && (
                          <div className="text-xs text-hos-text-muted">{center.postalCode}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {center.latitude != null && center.longitude != null ? (
                          <div className="text-xs">
                            <div className="text-hos-text-secondary">{Number(center.latitude).toFixed(4)}</div>
                            <div className="text-hos-text-muted">{Number(center.longitude).toFixed(4)}</div>
                          </div>
                        ) : (
                          <span className="text-xs text-hos-text-muted">Not set</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {center.contactEmail || center.contactPhone ? (
                          <div className="text-xs">
                            {center.contactEmail && <div className="text-hos-text-secondary">{center.contactEmail}</div>}
                            {center.contactPhone && <div className="text-hos-text-muted">{center.contactPhone}</div>}
                          </div>
                        ) : (
                          <span className="text-xs text-hos-text-muted">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            center.isActive !== false
                              ? 'bg-green-500/15 text-green-300'
                              : 'bg-hos-bg-tertiary text-hos-text-secondary'
                          }`}
                        >
                          {center.isActive !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          type="button"
                          onClick={() => openEditModal(center)}
                          className="text-hos-gold hover:text-hos-gold mr-3"
                        >
                          Edit
                        </button>
                        {deleteConfirmId === center.id ? (
                          <span className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleDelete(center.id)}
                              disabled={submitting}
                              className="text-white bg-red-600 px-2 py-1 rounded text-xs hover:bg-red-700 disabled:opacity-50"
                            >
                              Confirm delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(null)}
                              className="text-hos-text-secondary text-xs hover:text-hos-gold"
                            >
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(center.id)}
                            className="text-red-400 hover:text-red-300"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add Center Modal */}
        <Transition appear show={isModalOpen} as={Fragment}>
          <Dialog as="div" className="relative z-10" onClose={closeModal}>
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
                  <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-hos-bg-secondary p-6 text-left align-middle shadow-xl transition-all max-h-[90vh] overflow-y-auto">
                    <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-hos-text-secondary mb-4">
                      {editingCenter ? 'Edit Fulfillment Center' : 'Add Fulfillment Center'}
                    </Dialog.Title>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-hos-text-secondary">Name *</label>
                        <input
                          type="text"
                          required
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: sanitizeLabelInput(e.target.value, formData.name) })}
                          className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-hos-gold/50 focus:border-hos-gold ${isLabelInvalid(formData.name) ? 'border-red-500/40' : 'border-hos-border'}`}
                        />
                        {isLabelInvalid(formData.name) && (
                          <p className="text-xs text-red-400 mt-1">Must include at least one letter</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-hos-text-secondary">Address *</label>
                        <input
                          type="text"
                          required
                          value={formData.address}
                          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                          className="mt-1 block w-full px-3 py-2 border border-hos-border rounded-md shadow-sm focus:outline-none focus:ring-hos-gold/50 focus:border-hos-gold"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-hos-text-secondary">City *</label>
                          <input
                            type="text"
                            required
                            value={formData.city}
                            onChange={(e) => setFormData({ ...formData, city: sanitizeLabelInput(e.target.value, formData.city) })}
                            className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-hos-gold/50 focus:border-hos-gold ${isLabelInvalid(formData.city) ? 'border-red-500/40' : 'border-hos-border'}`}
                          />
                          {isLabelInvalid(formData.city) && (
                            <p className="text-xs text-red-400 mt-1">Must include at least one letter</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-hos-text-secondary">Country *</label>
                          <input
                            type="text"
                            required
                            value={formData.country}
                            onChange={(e) => setFormData({ ...formData, country: sanitizeLabelInput(e.target.value, formData.country) })}
                            className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-hos-gold/50 focus:border-hos-gold ${isLabelInvalid(formData.country) ? 'border-red-500/40' : 'border-hos-border'}`}
                          />
                          {isLabelInvalid(formData.country) && (
                            <p className="text-xs text-red-400 mt-1">Must include at least one letter</p>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-hos-text-secondary">Postal Code</label>
                        <input
                          type="text"
                          value={formData.postalCode}
                          onChange={(e) => setFormData({ ...formData, postalCode: sanitizePostalInput(e.target.value) })}
                          className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-hos-gold/50 focus:border-hos-gold ${isPostalInvalid(formData.postalCode) ? 'border-red-500/40' : 'border-hos-border'}`}
                        />
                        {isPostalInvalid(formData.postalCode) && (
                          <p className="text-xs text-red-400 mt-1">Must include at least one digit</p>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-hos-text-secondary">Contact Email</label>
                          <input
                            type="email"
                            value={formData.contactEmail}
                            onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                            className="mt-1 block w-full px-3 py-2 border border-hos-border rounded-md shadow-sm focus:outline-none focus:ring-hos-gold/50 focus:border-hos-gold"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-hos-text-secondary">Contact Phone</label>
                          <input
                            type="tel"
                            value={formData.contactPhone}
                            onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                            className="mt-1 block w-full px-3 py-2 border border-hos-border rounded-md shadow-sm focus:outline-none focus:ring-hos-gold/50 focus:border-hos-gold"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-hos-text-secondary">Latitude</label>
                          <input
                            type="number"
                            step="any"
                            value={formData.latitude}
                            onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                            placeholder="e.g., 51.5074"
                            className="mt-1 block w-full px-3 py-2 border border-hos-border rounded-md shadow-sm focus:outline-none focus:ring-hos-gold/50 focus:border-hos-gold"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-hos-text-secondary">Longitude</label>
                          <input
                            type="number"
                            step="any"
                            value={formData.longitude}
                            onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                            placeholder="e.g., -0.1278"
                            className="mt-1 block w-full px-3 py-2 border border-hos-border rounded-md shadow-sm focus:outline-none focus:ring-hos-gold/50 focus:border-hos-gold"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-hos-text-secondary">Capacity (units)</label>
                        <input
                          type="number"
                          value={formData.capacity}
                          onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                          placeholder="Storage capacity"
                          className="mt-1 block w-full px-3 py-2 border border-hos-border rounded-md shadow-sm focus:outline-none focus:ring-hos-gold/50 focus:border-hos-gold"
                        />
                      </div>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.isActive}
                          onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                          className="h-4 w-4 text-hos-gold focus:ring-hos-gold/50 border-hos-border rounded"
                        />
                        <label className="ml-2 block text-sm text-hos-text-secondary">Active</label>
                      </div>
                      <div className="flex justify-end gap-3 mt-6">
                        <button
                          type="button"
                          onClick={closeModal}
                          className="px-4 py-2 text-sm font-medium text-hos-text-secondary bg-hos-bg-tertiary rounded-lg hover:bg-hos-bg-tertiary"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={submitting}
                          className="px-4 py-2 text-sm font-medium text-hos-text-secondary bg-hos-gold rounded-lg hover:bg-hos-gold-hover disabled:opacity-50"
                        >
                          {submitting ? 'Saving...' : editingCenter ? 'Save changes' : 'Create Center'}
                        </button>
                      </div>
                    </form>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition>
      </AdminLayout>
    </RouteGuard>
  );
}

