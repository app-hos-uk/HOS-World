'use client';

import { useEffect, useState, Fragment } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { Dialog, Transition } from '@headlessui/react';

interface Integration {
  id: string;
  category: string;
  provider: string;
  displayName: string;
  description?: string;
  isActive: boolean;
  isTestMode: boolean;
  credentials: Record<string, any>;
  settings?: Record<string, any>;
  webhookUrl?: string;
  lastTestedAt?: string;
  testStatus?: string;
  testMessage?: string;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

interface ProviderMetadata {
  displayName: string;
  description: string;
  requiredCredentials: string[];
  optionalCredentials: string[];
  documentationUrl?: string;
}

interface CategoryProviders {
  [category: string]: Array<{ provider: string; metadata: ProviderMetadata }>;
}

const CATEGORY_INFO: Record<string, { name: string; icon: string; description: string }> = {
  SHIPPING: {
    name: 'Shipping Carriers',
    icon: '🚚',
    description: 'Configure shipping providers for label generation and tracking',
  },
  TAX: {
    name: 'Tax Services',
    icon: '📊',
    description: 'Automated tax calculation and compliance services',
  },
  PAYMENT: {
    name: 'Payment Gateways',
    icon: '💳',
    description: 'Payment processing providers',
  },
  EMAIL: {
    name: 'Email Services',
    icon: '📧',
    description: 'Email delivery and transactional email providers',
  },
  SMS: {
    name: 'SMS Services',
    icon: '📱',
    description: 'SMS and text messaging providers',
  },
  STORAGE: {
    name: 'Cloud Storage',
    icon: '☁️',
    description: 'File and media storage providers',
  },
  SEARCH: {
    name: 'Search Services',
    icon: '🔍',
    description: 'Search engine providers',
  },
  ANALYTICS: {
    name: 'Analytics',
    icon: '📈',
    description: 'Analytics and tracking providers',
  },
  MAPS: {
    name: 'Maps & Geocoding',
    icon: '🗺️',
    description: 'Mapping and geocoding services',
  },
};

export default function IntegrationsPage() {
  const toast = useToast();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [availableProviders, setAvailableProviders] = useState<CategoryProviders>({});
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    displayName: '',
    description: '',
    isTestMode: true,
    credentials: {} as Record<string, string>,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [integrationsRes, providersRes] = await Promise.all([
        apiClient.getIntegrations(),
        apiClient.getAvailableProviders(),
      ]);
      // Ensure data is an array before setting state
      if (integrationsRes?.data && Array.isArray(integrationsRes.data)) {
        setIntegrations(integrationsRes.data);
      } else {
        setIntegrations([]);
      }
      // Ensure providers data is an object
      if (providersRes?.data && typeof providersRes.data === 'object' && !Array.isArray(providersRes.data)) {
        setAvailableProviders(providersRes.data);
      } else {
        setAvailableProviders({});
      }
    } catch (error: any) {
      console.error('Error fetching integrations:', error);
      toast.error('Failed to load integrations');
      // Reset to empty on error
      setIntegrations([]);
      setAvailableProviders({});
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async (id: string) => {
    setTestingId(id);
    try {
      const result = await apiClient.testIntegrationConnection(id);
      if (result?.data?.success) {
        toast.success('Connection test successful!');
      } else {
        toast.error(result?.data?.message || 'Connection test failed');
      }
      fetchData(); // Refresh to get updated test status
    } catch (error: any) {
      toast.error(error.message || 'Connection test failed');
    } finally {
      setTestingId(null);
    }
  };

  const handleToggleActive = async (integration: Integration) => {
    try {
      if (integration.isActive) {
        await apiClient.deactivateIntegration(integration.id);
        toast.success(`${integration.displayName} deactivated`);
      } else {
        await apiClient.activateIntegration(integration.id);
        toast.success(`${integration.displayName} activated`);
      }
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update integration');
    }
  };

  const handleAddIntegration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategory || !selectedProvider) return;

    setSubmitting(true);
    try {
      await apiClient.createIntegration({
        category: selectedCategory,
        provider: selectedProvider,
        displayName: formData.displayName,
        description: formData.description || undefined,
        isTestMode: formData.isTestMode,
        credentials: formData.credentials,
      });
      toast.success('Integration added successfully!');
      setShowAddModal(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add integration');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteIntegration = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the ${name} integration?`)) return;

    try {
      await apiClient.deleteIntegration(id);
      toast.success('Integration deleted successfully');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete integration');
    }
  };

  const resetForm = () => {
    setSelectedCategory(null);
    setSelectedProvider(null);
    setFormData({
      displayName: '',
      description: '',
      isTestMode: true,
      credentials: {},
    });
  };

  const getProviderMetadata = (): ProviderMetadata | null => {
    if (!selectedCategory || !selectedProvider) return null;
    const providers = availableProviders[selectedCategory] || [];
    const found = providers.find((p) => p.provider === selectedProvider);
    return found?.metadata || null;
  };

  const getCategoryIntegrations = (category: string) => {
    return integrations.filter((i) => i.category === category);
  };

  const getStatusColor = (testStatus?: string) => {
    switch (testStatus) {
      case 'SUCCESS':
        return 'bg-green-100 text-green-800';
      case 'FAILED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (testStatus?: string) => {
    switch (testStatus) {
      case 'SUCCESS':
        return 'Connected';
      case 'FAILED':
        return 'Error';
      default:
        return 'Not Tested';
    }
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']} showAccessDenied={true}>
      <AdminLayout>
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href="/admin/settings" className="hover:text-purple-600">Settings</Link>
            <span>/</span>
            <span>Integrations</span>
          </div>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Integrations</h1>
              <p className="text-gray-600 mt-1">Manage third-party service connections</p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
            >
              + Add Integration
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading integrations...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(CATEGORY_INFO).map(([category, info]) => {
              const categoryIntegrations = getCategoryIntegrations(category);
              const categoryProviders = availableProviders[category] || [];

              return (
                <div key={category} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{info.icon}</span>
                      <div>
                        <h2 className="text-lg font-semibold">{info.name}</h2>
                        <p className="text-sm text-gray-600">{info.description}</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-6">
                    {categoryIntegrations.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <p>No integrations configured for this category.</p>
                        {categoryProviders.length > 0 && (
                          <button
                            onClick={() => {
                              setSelectedCategory(category);
                              setShowAddModal(true);
                            }}
                            className="mt-2 text-purple-600 hover:text-purple-700 font-medium"
                          >
                            Add {info.name.toLowerCase()} integration
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {categoryIntegrations.map((integration) => (
                          <div
                            key={integration.id}
                            className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 transition-colors"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h3 className="font-semibold">{integration.displayName}</h3>
                                <p className="text-sm text-gray-500">{integration.provider}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                                    integration.testStatus,
                                  )}`}
                                >
                                  {getStatusText(integration.testStatus)}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 mb-3">
                              <span
                                className={`px-2 py-1 text-xs rounded ${
                                  integration.isTestMode
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {integration.isTestMode ? 'Test Mode' : 'Production'}
                              </span>
                              <span
                                className={`px-2 py-1 text-xs rounded ${
                                  integration.isActive
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {integration.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </div>

                            {integration.lastTestedAt && (
                              <p className="text-xs text-gray-500 mb-3">
                                Last tested: {new Date(integration.lastTestedAt).toLocaleString()}
                              </p>
                            )}

                            <div className="flex gap-2 pt-3 border-t border-gray-100">
                              <button
                                onClick={() => handleTestConnection(integration.id)}
                                disabled={testingId === integration.id}
                                className="flex-1 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50"
                              >
                                {testingId === integration.id ? 'Testing...' : 'Test'}
                              </button>
                              <button
                                onClick={() => handleToggleActive(integration)}
                                className={`flex-1 px-3 py-1.5 text-sm rounded ${
                                  integration.isActive
                                    ? 'bg-orange-100 hover:bg-orange-200 text-orange-700'
                                    : 'bg-green-100 hover:bg-green-200 text-green-700'
                                }`}
                              >
                                {integration.isActive ? 'Disable' : 'Enable'}
                              </button>
                              <button
                                onClick={() =>
                                  handleDeleteIntegration(integration.id, integration.displayName)
                                }
                                className="px-3 py-1.5 text-sm bg-red-100 hover:bg-red-200 text-red-700 rounded"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add Integration Modal */}
        <Transition appear show={showAddModal} as={Fragment}>
          <Dialog as="div" className="relative z-50" onClose={() => setShowAddModal(false)}>
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
              <div className="flex min-h-full items-center justify-center p-4">
                <Transition.Child
                  as={Fragment}
                  enter="ease-out duration-300"
                  enterFrom="opacity-0 scale-95"
                  enterTo="opacity-100 scale-100"
                  leave="ease-in duration-200"
                  leaveFrom="opacity-100 scale-100"
                  leaveTo="opacity-0 scale-95"
                >
                  <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white p-6 shadow-xl transition-all">
                    <Dialog.Title as="h3" className="text-lg font-semibold mb-4">
                      Add Integration
                    </Dialog.Title>

                    <form onSubmit={handleAddIntegration} className="space-y-4">
                      {/* Category Selection */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Category *
                        </label>
                        <select
                          value={selectedCategory || ''}
                          onChange={(e) => {
                            setSelectedCategory(e.target.value || null);
                            setSelectedProvider(null);
                            setFormData({ ...formData, credentials: {} });
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                          required
                        >
                          <option value="">Select category...</option>
                          {Object.entries(CATEGORY_INFO).map(([cat, info]) => (
                            <option key={cat} value={cat}>
                              {info.icon} {info.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Provider Selection */}
                      {selectedCategory && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Provider *
                          </label>
                          <select
                            value={selectedProvider || ''}
                            onChange={(e) => {
                              setSelectedProvider(e.target.value || null);
                              const providers = availableProviders[selectedCategory] || [];
                              const prov = providers.find((p) => p.provider === e.target.value);
                              if (prov) {
                                setFormData({
                                  ...formData,
                                  displayName: prov.metadata.displayName,
                                  description: prov.metadata.description,
                                  credentials: {},
                                });
                              }
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                            required
                          >
                            <option value="">Select provider...</option>
                            {(availableProviders[selectedCategory] || []).map(({ provider, metadata }) => (
                              <option key={provider} value={provider}>
                                {metadata.displayName}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Display Name */}
                      {selectedProvider && (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Display Name *
                            </label>
                            <input
                              type="text"
                              value={formData.displayName}
                              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                              required
                            />
                          </div>

                          {/* Test Mode Toggle */}
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="testMode"
                              checked={formData.isTestMode}
                              onChange={(e) => setFormData({ ...formData, isTestMode: e.target.checked })}
                              className="h-4 w-4 text-purple-600 rounded"
                            />
                            <label htmlFor="testMode" className="text-sm">
                              Test/Sandbox Mode
                            </label>
                          </div>

                          {/* Credentials */}
                          {getProviderMetadata() && (
                            <div className="space-y-3">
                              <h4 className="text-sm font-medium text-gray-700">Credentials</h4>
                              {getProviderMetadata()!.requiredCredentials.map((field) => (
                                <div key={field}>
                                  <label className="block text-sm text-gray-600 mb-1">
                                    {field.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())} *
                                  </label>
                                  <input
                                    type={field.toLowerCase().includes('secret') || field.toLowerCase().includes('key') || field.toLowerCase().includes('password') ? 'password' : 'text'}
                                    value={formData.credentials[field] || ''}
                                    onChange={(e) =>
                                      setFormData({
                                        ...formData,
                                        credentials: { ...formData.credentials, [field]: e.target.value },
                                      })
                                    }
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                                    required
                                  />
                                </div>
                              ))}
                              {getProviderMetadata()!.optionalCredentials.map((field) => (
                                <div key={field}>
                                  <label className="block text-sm text-gray-600 mb-1">
                                    {field.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}
                                  </label>
                                  <input
                                    type={field.toLowerCase().includes('secret') || field.toLowerCase().includes('key') ? 'password' : 'text'}
                                    value={formData.credentials[field] || ''}
                                    onChange={(e) =>
                                      setFormData({
                                        ...formData,
                                        credentials: { ...formData.credentials, [field]: e.target.value },
                                      })
                                    }
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                                  />
                                </div>
                              ))}

                              {getProviderMetadata()!.documentationUrl && (
                                <p className="text-sm text-gray-500">
                                  <a
                                    href={getProviderMetadata()!.documentationUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-purple-600 hover:underline"
                                  >
                                    View API documentation →
                                  </a>
                                </p>
                              )}
                            </div>
                          )}
                        </>
                      )}

                      <div className="flex justify-end gap-3 pt-4">
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddModal(false);
                            resetForm();
                          }}
                          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={submitting || !selectedProvider}
                          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                        >
                          {submitting ? 'Adding...' : 'Add Integration'}
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
