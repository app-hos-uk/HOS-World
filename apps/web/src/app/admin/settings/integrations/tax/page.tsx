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
  features: string[];
  documentationUrl?: string;
}

const TAX_PROVIDERS: Record<string, ProviderMetadata> = {
  avalara: {
    displayName: 'Avalara AvaTax',
    description: 'Enterprise-grade tax automation for sales tax, VAT, and GST calculations with full compliance',
    requiredCredentials: ['accountId', 'licenseKey', 'companyCode'],
    optionalCredentials: [],
    features: [
      'Real-time tax calculation',
      'Address validation',
      'Exemption certificate management',
      'Multi-jurisdiction support',
      'Automatic filing & remittance',
      'VAT/GST for 100+ countries',
    ],
    documentationUrl: 'https://developer.avalara.com/',
  },
  taxjar: {
    displayName: 'TaxJar',
    description: 'Automated sales tax calculation and reporting for ecommerce businesses',
    requiredCredentials: ['apiToken'],
    optionalCredentials: [],
    features: [
      'Sales tax calculation',
      'Product tax codes',
      'Nexus tracking',
      'Auto-filing in supported states',
      'Transaction reporting',
      'API-first design',
    ],
    documentationUrl: 'https://developers.taxjar.com/',
  },
};

export default function TaxIntegrationsPage() {
  const toast = useToast();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [editingIntegration, setEditingIntegration] = useState<Integration | null>(null);
  const [formData, setFormData] = useState({
    displayName: '',
    description: '',
    isTestMode: true,
    isActive: false,
    credentials: {} as Record<string, string>,
    priority: 0,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const fetchIntegrations = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getIntegrationsByCategory('TAX');
      // Ensure data is an array before setting state
      if (response?.data && Array.isArray(response.data)) {
        setIntegrations(response.data);
      } else {
        setIntegrations([]);
      }
    } catch (error: any) {
      console.error('Error fetching tax integrations:', error);
      toast.error('Failed to load tax integrations');
      setIntegrations([]);
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
      fetchIntegrations();
    } catch (error: any) {
      toast.error(error.message || 'Connection test failed');
    } finally {
      setTestingId(null);
    }
  };

  const handleConfigure = (provider: string, integration?: Integration) => {
    const metadata = TAX_PROVIDERS[provider];
    setSelectedProvider(provider);
    setEditingIntegration(integration || null);
    
    if (integration) {
      setFormData({
        displayName: integration.displayName,
        description: integration.description || '',
        isTestMode: integration.isTestMode,
        isActive: integration.isActive,
        credentials: integration.credentials || {},
        priority: integration.priority,
      });
    } else {
      setFormData({
        displayName: metadata?.displayName || provider,
        description: metadata?.description || '',
        isTestMode: true,
        isActive: false,
        credentials: {},
        priority: 0,
      });
    }
    
    setShowConfigModal(true);
  };

  const handleSaveConfiguration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProvider) return;

    setSubmitting(true);
    try {
      if (editingIntegration) {
        await apiClient.updateIntegration(editingIntegration.id, {
          displayName: formData.displayName,
          description: formData.description || undefined,
          isTestMode: formData.isTestMode,
          isActive: formData.isActive,
          credentials: formData.credentials,
          priority: formData.priority,
        });
        toast.success('Tax integration updated successfully!');
      } else {
        await apiClient.createIntegration({
          category: 'TAX',
          provider: selectedProvider,
          displayName: formData.displayName,
          description: formData.description || undefined,
          isTestMode: formData.isTestMode,
          isActive: formData.isActive,
          credentials: formData.credentials,
          priority: formData.priority,
        });
        toast.success('Tax integration configured successfully!');
      }
      
      setShowConfigModal(false);
      fetchIntegrations();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save integration');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (integration: Integration) => {
    try {
      if (integration.isActive) {
        await apiClient.deactivateIntegration(integration.id);
        toast.success(`${integration.displayName} deactivated`);
      } else {
        // Deactivate other tax providers first (only one can be active)
        for (const other of integrations) {
          if (other.isActive && other.id !== integration.id) {
            await apiClient.deactivateIntegration(other.id);
          }
        }
        await apiClient.activateIntegration(integration.id);
        toast.success(`${integration.displayName} activated`);
      }
      fetchIntegrations();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update integration');
    }
  };

  const handleDeleteIntegration = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the ${name} integration? This will remove all stored credentials.`)) return;

    try {
      await apiClient.deleteIntegration(id);
      toast.success('Integration deleted successfully');
      fetchIntegrations();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete integration');
    }
  };

  const getIntegration = (provider: string): Integration | undefined => {
    return integrations.find((i) => i.provider === provider);
  };

  const getStatusColor = (testStatus?: string) => {
    switch (testStatus) {
      case 'SUCCESS': return 'text-green-600 bg-green-100';
      case 'FAILED': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusText = (testStatus?: string) => {
    switch (testStatus) {
      case 'SUCCESS': return 'Connected';
      case 'FAILED': return 'Connection Error';
      default: return 'Not Tested';
    }
  };

  const activeProvider = integrations.find((i) => i.isActive);

  return (
    <RouteGuard allowedRoles={['ADMIN']} showAccessDenied={true}>
      <AdminLayout>
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href="/admin/settings" className="hover:text-purple-600">Settings</Link>
            <span>/</span>
            <Link href="/admin/settings/integrations" className="hover:text-purple-600">Integrations</Link>
            <span>/</span>
            <span>Tax Services</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold">Tax Services</h1>
          <p className="text-gray-600 mt-1">Configure automated tax calculation and compliance services</p>
        </div>

        {/* Active Provider Banner */}
        {activeProvider && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-green-800">
                  {activeProvider.displayName} is active
                </p>
                <p className="text-sm text-green-700">
                  {activeProvider.isTestMode ? 'Running in test mode' : 'Running in production mode'}
                  {activeProvider.lastTestedAt && ` • Last tested ${new Date(activeProvider.lastTestedAt).toLocaleDateString()}`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Fallback Notice */}
        {!activeProvider && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-yellow-800">
                  No external tax service configured
                </p>
                <p className="text-sm text-yellow-700">
                  Tax calculations will use your manually configured tax zones and rates
                </p>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading tax integrations...</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {Object.entries(TAX_PROVIDERS).map(([provider, metadata]) => {
              const integration = getIntegration(provider);
              const isConfigured = !!integration;
              const isActive = integration?.isActive;

              return (
                <div
                  key={provider}
                  className={`bg-white border rounded-lg overflow-hidden ${
                    isActive
                      ? 'border-green-300 shadow-lg ring-2 ring-green-200'
                      : 'border-gray-200'
                  }`}
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-semibold">{metadata.displayName}</h3>
                        <p className="text-gray-600 mt-1">{metadata.description}</p>
                      </div>
                      {isActive && (
                        <span className="px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          Active
                        </span>
                      )}
                    </div>

                    {/* Features */}
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Features</h4>
                      <ul className="grid grid-cols-2 gap-1">
                        {metadata.features.map((feature, index) => (
                          <li key={index} className="flex items-center gap-1 text-sm text-gray-600">
                            <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {isConfigured ? (
                      <>
                        <div className="flex flex-wrap items-center gap-2 mb-4 pt-4 border-t">
                          <span
                            className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                              integration.testStatus,
                            )}`}
                          >
                            {getStatusText(integration.testStatus)}
                          </span>
                          <span
                            className={`px-2 py-1 text-xs rounded ${
                              integration.isTestMode
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {integration.isTestMode ? 'Sandbox' : 'Production'}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => handleConfigure(provider, integration)}
                            className="flex-1 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded font-medium"
                          >
                            Configure
                          </button>
                          <button
                            onClick={() => handleTestConnection(integration.id)}
                            disabled={testingId === integration.id}
                            className="px-3 py-2 text-sm bg-purple-100 hover:bg-purple-200 text-purple-700 rounded disabled:opacity-50"
                          >
                            {testingId === integration.id ? 'Testing...' : 'Test'}
                          </button>
                          <button
                            onClick={() => handleToggleActive(integration)}
                            className={`px-4 py-2 text-sm rounded font-medium ${
                              isActive
                                ? 'bg-orange-100 hover:bg-orange-200 text-orange-700'
                                : 'bg-green-600 hover:bg-green-700 text-white'
                            }`}
                          >
                            {isActive ? 'Deactivate' : 'Make Active'}
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="pt-4 border-t">
                        <button
                          onClick={() => handleConfigure(provider)}
                          className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
                        >
                          Set Up {metadata.displayName}
                        </button>
                        {metadata.documentationUrl && (
                          <a
                            href={metadata.documentationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-center text-sm text-purple-600 hover:underline mt-2"
                          >
                            View Documentation →
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Manual Tax Configuration Link */}
        <div className="mt-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold mb-2">Manual Tax Configuration</h3>
          <p className="text-gray-600 mb-4">
            You can also configure tax zones and rates manually without an external provider.
            Manual rates will be used as a fallback if no provider is active.
          </p>
          <Link
            href="/admin/tax-zones"
            className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700 font-medium"
          >
            Manage Tax Zones & Rates →
          </Link>
        </div>

        {/* Configuration Modal */}
        <Transition appear show={showConfigModal} as={Fragment}>
          <Dialog as="div" className="relative z-50" onClose={() => setShowConfigModal(false)}>
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
                      {editingIntegration ? 'Edit' : 'Configure'} {selectedProvider && TAX_PROVIDERS[selectedProvider]?.displayName}
                    </Dialog.Title>

                    {selectedProvider && (
                      <form onSubmit={handleSaveConfiguration} className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Display Name
                          </label>
                          <input
                            type="text"
                            value={formData.displayName}
                            onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                            required
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="testMode"
                              checked={formData.isTestMode}
                              onChange={(e) => setFormData({ ...formData, isTestMode: e.target.checked })}
                              className="h-4 w-4 text-purple-600 rounded"
                            />
                            <label htmlFor="testMode" className="text-sm">
                              Sandbox Mode
                            </label>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="isActive"
                              checked={formData.isActive}
                              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                              className="h-4 w-4 text-purple-600 rounded"
                            />
                            <label htmlFor="isActive" className="text-sm">
                              Set as Active
                            </label>
                          </div>
                        </div>

                        <div className="border-t pt-4">
                          <h4 className="text-sm font-medium text-gray-700 mb-3">API Credentials</h4>
                          {TAX_PROVIDERS[selectedProvider]?.requiredCredentials.map((field) => (
                            <div key={field} className="mb-3">
                              <label className="block text-sm text-gray-600 mb-1">
                                {field.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())} *
                              </label>
                              <input
                                type={field.toLowerCase().includes('key') || field.toLowerCase().includes('token') || field.toLowerCase().includes('secret') ? 'password' : 'text'}
                                value={formData.credentials[field] || ''}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    credentials: { ...formData.credentials, [field]: e.target.value },
                                  })
                                }
                                placeholder={editingIntegration ? '(unchanged)' : ''}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                                required={!editingIntegration}
                              />
                            </div>
                          ))}
                        </div>

                        {TAX_PROVIDERS[selectedProvider]?.documentationUrl && (
                          <p className="text-sm text-gray-500">
                            Need API credentials?{' '}
                            <a
                              href={TAX_PROVIDERS[selectedProvider].documentationUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-purple-600 hover:underline"
                            >
                              Visit {TAX_PROVIDERS[selectedProvider].displayName} →
                            </a>
                          </p>
                        )}

                        <div className="flex justify-between pt-4">
                          {editingIntegration && (
                            <button
                              type="button"
                              onClick={() => handleDeleteIntegration(editingIntegration.id, editingIntegration.displayName)}
                              className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                            >
                              Delete
                            </button>
                          )}
                          <div className="flex gap-3 ml-auto">
                            <button
                              type="button"
                              onClick={() => setShowConfigModal(false)}
                              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={submitting}
                              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                            >
                              {submitting ? 'Saving...' : 'Save Configuration'}
                            </button>
                          </div>
                        </div>
                      </form>
                    )}
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
