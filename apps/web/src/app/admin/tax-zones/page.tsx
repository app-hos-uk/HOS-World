'use client';

import { useEffect, useState, Fragment } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { Dialog, Transition } from '@headlessui/react';

interface TaxZone {
  id: string;
  name: string;
  country?: string;
  state?: string;
  city?: string;
  postalCodes: string[];
  isActive: boolean;
  rates?: TaxRate[];
  createdAt: string;
  updatedAt: string;
}

interface TaxRate {
  id: string;
  taxZoneId: string;
  taxClassId?: string;
  rate: number;
  isInclusive: boolean;
  isActive: boolean;
  taxClass?: {
    id: string;
    name: string;
  };
}

interface TaxClass {
  id: string;
  name: string;
  description?: string;
}

export default function AdminTaxZonesPage() {
  const toast = useToast();
  const [zones, setZones] = useState<TaxZone[]>([]);
  const [taxClasses, setTaxClasses] = useState<TaxClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<TaxZone | null>(null);
  const [showZoneModal, setShowZoneModal] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [zoneFormData, setZoneFormData] = useState({
    name: '',
    country: '',
    state: '',
    city: '',
    postalCodes: [] as string[],
    postalCodeInput: '',
    isActive: true,
  });
  const [rateFormData, setRateFormData] = useState({
    taxZoneId: '',
    taxClassId: '',
    rate: 0,
    isInclusive: false,
    isActive: true,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTaxZones();
    fetchTaxClasses();
  }, []);

  const fetchTaxZones = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getTaxZones(true);
      if (response?.data && Array.isArray(response.data)) {
      // Zones already include rates from the API, but ensure it's an array
      const zonesWithRates = response.data.map((zone: TaxZone) => ({
        ...zone,
        rates: zone.rates || [],
      }));
      setZones(zonesWithRates);
      }
    } catch (err: any) {
      console.error('Error fetching tax zones:', err);
      setError(err.message || 'Failed to load tax zones');
      toast.error(err.message || 'Failed to load tax zones');
    } finally {
      setLoading(false);
    }
  };

  const fetchTaxClasses = async () => {
    try {
      const response = await apiClient.getTaxClasses();
      if (response?.data && Array.isArray(response.data)) {
        setTaxClasses(response.data);
      }
    } catch (err: any) {
      console.error('Error fetching tax classes:', err);
    }
  };

  const handleZoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const { postalCodeInput, ...submitData } = zoneFormData;
      if (isEditMode && selectedZone) {
        await apiClient.updateTaxZone(selectedZone.id, submitData);
        toast.success('Tax zone updated successfully!');
      } else {
        await apiClient.createTaxZone(submitData);
        toast.success('Tax zone created successfully!');
      }
      setShowZoneModal(false);
      resetZoneForm();
      fetchTaxZones();
    } catch (err: any) {
      console.error('Error saving tax zone:', err);
      toast.error(err.message || 'Failed to save tax zone');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await apiClient.createTaxRate(rateFormData);
      toast.success('Tax rate created successfully!');
      setShowRateModal(false);
      resetRateForm();
      fetchTaxZones();
    } catch (err: any) {
      console.error('Error saving tax rate:', err);
      toast.error(err.message || 'Failed to save tax rate');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteZone = async (id: string) => {
    if (!confirm('Are you sure you want to delete this tax zone? This will also delete all associated tax rates.')) {
      return;
    }
    try {
      await apiClient.deleteTaxZone(id);
      toast.success('Tax zone deleted successfully!');
      fetchTaxZones();
    } catch (err: any) {
      console.error('Error deleting tax zone:', err);
      toast.error(err.message || 'Failed to delete tax zone');
    }
  };

  const handleDeleteRate = async (rateId: string) => {
    if (!confirm('Are you sure you want to delete this tax rate?')) {
      return;
    }
    try {
      await apiClient.deleteTaxRate(rateId);
      toast.success('Tax rate deleted successfully!');
      fetchTaxZones();
    } catch (err: any) {
      console.error('Error deleting tax rate:', err);
      toast.error(err.message || 'Failed to delete tax rate');
    }
  };

  const handleEditZone = (zone: TaxZone) => {
    setSelectedZone(zone);
    setIsEditMode(true);
    setZoneFormData({
      name: zone.name,
      country: zone.country || '',
      state: zone.state || '',
      city: zone.city || '',
      postalCodes: zone.postalCodes || [],
      postalCodeInput: '',
      isActive: zone.isActive,
    });
    setShowZoneModal(true);
  };

  const addPostalCode = () => {
    if (zoneFormData.postalCodeInput.trim()) {
      setZoneFormData({
        ...zoneFormData,
        postalCodes: [...zoneFormData.postalCodes, zoneFormData.postalCodeInput.trim()],
        postalCodeInput: '',
      });
    }
  };

  const removePostalCode = (index: number) => {
    setZoneFormData({
      ...zoneFormData,
      postalCodes: zoneFormData.postalCodes.filter((_, i) => i !== index),
    });
  };

  const resetZoneForm = () => {
    setZoneFormData({
      name: '',
      country: '',
      state: '',
      city: '',
      postalCodes: [],
      postalCodeInput: '',
      isActive: true,
    });
    setIsEditMode(false);
    setSelectedZone(null);
  };

  const resetRateForm = () => {
    setRateFormData({
      taxZoneId: selectedZone?.id || '',
      taxClassId: '',
      rate: 0,
      isInclusive: false,
      isActive: true,
    });
  };

  const openRateModal = (zone: TaxZone) => {
    setSelectedZone(zone);
    setRateFormData({
      taxZoneId: zone.id,
      taxClassId: '',
      rate: 0,
      isInclusive: false,
      isActive: true,
    });
    setShowRateModal(true);
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-purple-900 mb-2">Tax Zones Management</h1>
              <p className="text-gray-600">Configure tax zones, classes, and rates</p>
            </div>
            <button
              onClick={() => {
                resetZoneForm();
                setShowZoneModal(true);
              }}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              + Add Tax Zone
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
              <p className="mt-4 text-gray-600">Loading tax zones...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {zones.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-8 text-center">
                  <p className="text-gray-500">No tax zones found. Create your first tax zone to get started.</p>
                </div>
              ) : (
                zones.map((zone) => (
                  <div key={zone.id} className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{zone.name}</h3>
                          <p className="text-sm text-gray-600 mt-1">
                            {zone.city && `${zone.city}, `}
                            {zone.state && `${zone.state}, `}
                            {zone.country || 'Global'}
                            {zone.postalCodes.length > 0 && ` (${zone.postalCodes.length} postal codes)`}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              zone.isActive
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {zone.isActive ? 'Active' : 'Inactive'}
                          </span>
                          <button
                            onClick={() => openRateModal(zone)}
                            className="text-sm text-purple-600 hover:text-purple-900 font-medium"
                          >
                            + Add Rate
                          </button>
                          <button
                            onClick={() => handleEditZone(zone)}
                            className="text-sm text-gray-600 hover:text-gray-900"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteZone(zone.id)}
                            className="text-sm text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="px-6 py-4">
                      {zone.rates && zone.rates.length > 0 ? (
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                Tax Class
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                Rate
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                Type
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                Status
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {zone.rates.map((rate) => (
                              <tr key={rate.id}>
                                <td className="px-4 py-2 text-sm">
                                  {rate.taxClass?.name || 'Default'}
                                </td>
                                <td className="px-4 py-2 text-sm font-medium">
                                  {(rate.rate * 100).toFixed(2)}%
                                </td>
                                <td className="px-4 py-2 text-sm">
                                  {rate.isInclusive ? 'Inclusive' : 'Exclusive'}
                                </td>
                                <td className="px-4 py-2 text-sm">
                                  <span
                                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                      rate.isActive
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-gray-100 text-gray-800'
                                    }`}
                                  >
                                    {rate.isActive ? 'Active' : 'Inactive'}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-sm">
                                  <button
                                    onClick={() => handleDeleteRate(rate.id)}
                                    className="text-red-600 hover:text-red-900"
                                  >
                                    Delete
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="text-sm text-gray-500">No tax rates configured. Add a rate to get started.</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Zone Modal */}
          <Transition appear show={showZoneModal} as={Fragment}>
            <Dialog as="div" className="relative z-10" onClose={() => setShowZoneModal(false)}>
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
                    <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                      <Dialog.Title
                        as="h3"
                        className="text-lg font-medium leading-6 text-gray-900 mb-4"
                      >
                        {isEditMode ? 'Edit Tax Zone' : 'Create New Tax Zone'}
                      </Dialog.Title>

                      <form onSubmit={handleZoneSubmit} className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Zone Name *
                          </label>
                          <input
                            type="text"
                            required
                            value={zoneFormData.name}
                            onChange={(e) => setZoneFormData({ ...zoneFormData, name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="e.g., UK Standard Rate"
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Country
                            </label>
                            <input
                              type="text"
                              value={zoneFormData.country}
                              onChange={(e) => setZoneFormData({ ...zoneFormData, country: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                              placeholder="GB"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              State/Region
                            </label>
                            <input
                              type="text"
                              value={zoneFormData.state}
                              onChange={(e) => setZoneFormData({ ...zoneFormData, state: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              City
                            </label>
                            <input
                              type="text"
                              value={zoneFormData.city}
                              onChange={(e) => setZoneFormData({ ...zoneFormData, city: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Postal Codes (optional)
                          </label>
                          <div className="flex space-x-2">
                            <input
                              type="text"
                              value={zoneFormData.postalCodeInput}
                              onChange={(e) => setZoneFormData({ ...zoneFormData, postalCodeInput: e.target.value })}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  addPostalCode();
                                }
                              }}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                              placeholder="Enter postal code and press Enter"
                            />
                            <button
                              type="button"
                              onClick={addPostalCode}
                              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium"
                            >
                              Add
                            </button>
                          </div>
                          {zoneFormData.postalCodes.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {zoneFormData.postalCodes.map((code, index) => (
                                <span
                                  key={index}
                                  className="inline-flex items-center px-2 py-1 rounded-md bg-purple-100 text-purple-800 text-sm"
                                >
                                  {code}
                                  <button
                                    type="button"
                                    onClick={() => removePostalCode(index)}
                                    className="ml-2 text-purple-600 hover:text-purple-900"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {isEditMode && (
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              id="zoneIsActive"
                              checked={zoneFormData.isActive}
                              onChange={(e) => setZoneFormData({ ...zoneFormData, isActive: e.target.checked })}
                              className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                            />
                            <label htmlFor="zoneIsActive" className="ml-2 block text-sm text-gray-900">
                              Active
                            </label>
                          </div>
                        )}

                        <div className="flex justify-end space-x-3 mt-6">
                          <button
                            type="button"
                            onClick={() => setShowZoneModal(false)}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={submitting}
                            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50"
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

          {/* Rate Modal */}
          <Transition appear show={showRateModal} as={Fragment}>
            <Dialog as="div" className="relative z-10" onClose={() => setShowRateModal(false)}>
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
                    <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                      <Dialog.Title
                        as="h3"
                        className="text-lg font-medium leading-6 text-gray-900 mb-4"
                      >
                        Add Tax Rate to {selectedZone?.name}
                      </Dialog.Title>

                      <form onSubmit={handleRateSubmit} className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Tax Class (optional)
                          </label>
                          <select
                            value={rateFormData.taxClassId}
                            onChange={(e) => setRateFormData({ ...rateFormData, taxClassId: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                          >
                            <option value="">Default (all classes)</option>
                            {taxClasses.map((tc) => (
                              <option key={tc.id} value={tc.id}>
                                {tc.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Tax Rate (%) *
                          </label>
                          <input
                            type="number"
                            required
                            step="0.01"
                            min="0"
                            max="100"
                            value={rateFormData.rate * 100}
                            onChange={(e) => {
                              const percentage = parseFloat(e.target.value) || 0;
                              setRateFormData({ ...rateFormData, rate: percentage / 100 });
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="20"
                          />
                          <p className="mt-1 text-sm text-gray-500">
                            Enter as percentage (e.g., 20 for 20%). Stored as decimal (0.20).
                          </p>
                        </div>

                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id="isInclusive"
                            checked={rateFormData.isInclusive}
                            onChange={(e) =>
                              setRateFormData({ ...rateFormData, isInclusive: e.target.checked })
                            }
                            className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                          />
                          <label htmlFor="isInclusive" className="ml-2 block text-sm text-gray-900">
                            Tax-inclusive pricing (tax included in product price)
                          </label>
                        </div>

                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id="rateIsActive"
                            checked={rateFormData.isActive}
                            onChange={(e) =>
                              setRateFormData({ ...rateFormData, isActive: e.target.checked })
                            }
                            className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                          />
                          <label htmlFor="rateIsActive" className="ml-2 block text-sm text-gray-900">
                            Active
                          </label>
                        </div>

                        <div className="flex justify-end space-x-3 mt-6">
                          <button
                            type="button"
                            onClick={() => setShowRateModal(false)}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={submitting}
                            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50"
                          >
                            {submitting ? 'Saving...' : 'Create Rate'}
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
