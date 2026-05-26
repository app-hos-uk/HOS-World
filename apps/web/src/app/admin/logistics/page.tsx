'use client';

import { useEffect, useState, Fragment } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { Dialog, Transition } from '@headlessui/react';

export default function AdminLogisticsPage() {
  const toast = useToast();
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    contactEmail: '',
    contactPhone: '',
    website: '',
    active: true,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchPartners();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchPartners = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getLogisticsPartners();
      let partnerData: any[] = [];
      if (response && 'data' in response) {
        const responseData = response.data as any;
        if (Array.isArray(responseData)) {
          partnerData = responseData;
        } else if (responseData && typeof responseData === 'object' && 'data' in responseData && Array.isArray(responseData.data)) {
          partnerData = responseData.data;
        }
      }
      setPartners(partnerData);
    } catch (err: any) {
      console.error('Error fetching logistics partners:', err);
      setError(err.message || 'Failed to load logistics partners');
      setPartners([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // API client internally transforms contactEmail/contactPhone to contactInfo
      const response = await apiClient.createLogisticsPartner({
        name: formData.name,
        type: formData.type,
        website: formData.website || undefined,
        contactEmail: formData.contactEmail || undefined,
        contactPhone: formData.contactPhone || undefined,
        isActive: formData.active !== undefined ? formData.active : true,
      });
      if (response?.data) {
        toast.success('Logistics partner created successfully!');
        setIsModalOpen(false);
        setFormData({
          name: '',
          type: '',
          contactEmail: '',
          contactPhone: '',
          website: '',
          active: true,
        });
        fetchPartners();
      } else {
        toast.error(response.message || 'Failed to create logistics partner');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to create logistics partner');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <RouteGuard allowedRoles={['ADMIN']}>
        <AdminLayout>
          <div className="flex items-center justify-center h-64">
            <div className="text-hos-text-muted">Loading logistics partners...</div>
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
              onClick={fetchPartners}
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
            <h1 className="text-2xl font-bold text-hos-text-secondary">Logistics Partners</h1>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover"
            >
              Add Partner
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
                    Type
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
                {partners.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-hos-text-muted">
                      No logistics partners found
                    </td>
                  </tr>
                ) : (
                  partners.map((partner) => (
                    <tr key={partner.id} className="hover:bg-hos-bg-tertiary">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-hos-text-secondary">
                        {partner.name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-hos-text-muted">
                        {partner.type || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            partner.active !== false
                              ? 'bg-green-500/15 text-green-300'
                              : 'bg-hos-bg-tertiary text-hos-text-secondary'
                          }`}
                        >
                          {partner.active !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button className="text-hos-gold hover:text-hos-gold">Edit</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add Partner Modal */}
        <Transition appear show={isModalOpen} as={Fragment}>
          <Dialog as="div" className="relative z-10" onClose={() => setIsModalOpen(false)}>
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
                  <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-hos-bg-secondary p-6 text-left align-middle shadow-xl transition-all">
                    <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-hos-text-secondary mb-4">
                      Add Logistics Partner
                    </Dialog.Title>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-hos-text-secondary">Name *</label>
                        <input
                          type="text"
                          required
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="mt-1 block w-full px-3 py-2 border border-hos-border rounded-md shadow-sm focus:outline-none focus:ring-hos-gold/50 focus:border-hos-gold"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-hos-text-secondary">Type *</label>
                        <select
                          required
                          value={formData.type}
                          onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                          className="mt-1 block w-full px-3 py-2 border border-hos-border rounded-md shadow-sm focus:outline-none focus:ring-hos-gold/50 focus:border-hos-gold"
                        >
                          <option value="">Select type</option>
                          <option value="SHIPPING">Shipping</option>
                          <option value="COURIER">Courier</option>
                          <option value="FREIGHT">Freight</option>
                          <option value="EXPRESS">Express</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-hos-text-secondary">Website</label>
                        <input
                          type="url"
                          value={formData.website}
                          onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                          className="mt-1 block w-full px-3 py-2 border border-hos-border rounded-md shadow-sm focus:outline-none focus:ring-hos-gold/50 focus:border-hos-gold"
                        />
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
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.active}
                          onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                          className="h-4 w-4 text-hos-gold focus:ring-hos-gold/50 border-hos-border rounded"
                        />
                        <label className="ml-2 block text-sm text-hos-text-secondary">Active</label>
                      </div>
                      <div className="flex justify-end gap-3 mt-6">
                        <button
                          type="button"
                          onClick={() => setIsModalOpen(false)}
                          className="px-4 py-2 text-sm font-medium text-hos-text-secondary bg-hos-bg-tertiary rounded-lg hover:bg-hos-bg-tertiary"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={submitting}
                          className="px-4 py-2 text-sm font-medium text-hos-text-secondary bg-hos-gold rounded-lg hover:bg-hos-gold-hover disabled:opacity-50"
                        >
                          {submitting ? 'Creating...' : 'Create Partner'}
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

