'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

interface Seller {
  id: string;
  storeName: string;
  slug: string;
  sellerType: string;
  customDomain?: string;
  subDomain?: string;
  domainPackagePurchased: boolean;
  user: {
    email: string;
    firstName?: string;
    lastName?: string;
  };
}

export default function AdminDomainsPage() {
  const toast = useToast();
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
  const [showSubDomainModal, setShowSubDomainModal] = useState(false);
  const [showCustomDomainModal, setShowCustomDomainModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Form state
  const [subDomainForm, setSubDomainForm] = useState({
    subDomain: '',
  });
  const [customDomainForm, setCustomDomainForm] = useState({
    customDomain: '',
    domainPackagePurchased: false,
  });

  useEffect(() => {
    fetchSellers();
  }, []);

  const fetchSellers = async () => {
    try {
      setLoading(true);
      // We'll need to create an admin endpoint to get all sellers with domain info
      const response = await apiClient.getAdminSellers?.();
      if (response?.data) {
        setSellers(response.data);
      }
    } catch (err: any) {
      console.error('Error fetching sellers:', err);
      toast.error(err.message || 'Failed to load sellers');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSubDomain = async () => {
    if (!selectedSeller) return;

    // Auto-generate subdomain from store name
    const generated = selectedSeller.slug
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .substring(0, 50);

    setSubDomainForm({ subDomain: generated });
    setShowSubDomainModal(true);
  };

  const handleAssignSubDomain = async () => {
    if (!selectedSeller || !subDomainForm.subDomain) {
      toast.error('Please enter a subdomain');
      return;
    }

    try {
      setActionLoading(true);
      await toast.promise(
        apiClient.assignSubDomain?.(selectedSeller.id, { subDomain: subDomainForm.subDomain }),
        {
          loading: 'Assigning subdomain...',
          success: 'Subdomain assigned successfully',
          error: (err) => err.message || 'Failed to assign subdomain',
        }
      );
      setShowSubDomainModal(false);
      setSubDomainForm({ subDomain: '' });
      await fetchSellers();
    } catch (err: any) {
      console.error('Error assigning subdomain:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignCustomDomain = async () => {
    if (!selectedSeller || !customDomainForm.customDomain) {
      toast.error('Please enter a custom domain');
      return;
    }

    try {
      setActionLoading(true);
      await toast.promise(
        apiClient.assignCustomDomain?.(selectedSeller.id, {
          customDomain: customDomainForm.customDomain,
          domainPackagePurchased: customDomainForm.domainPackagePurchased,
        }),
        {
          loading: 'Assigning custom domain...',
          success: 'Custom domain assigned successfully',
          error: (err) => err.message || 'Failed to assign custom domain',
        }
      );
      setShowCustomDomainModal(false);
      setCustomDomainForm({ customDomain: '', domainPackagePurchased: false });
      await fetchSellers();
    } catch (err: any) {
      console.error('Error assigning custom domain:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveDomain = async (seller: Seller, type: 'subdomain' | 'custom') => {
    if (!confirm(`Are you sure you want to remove the ${type} for ${seller.storeName}?`)) {
      return;
    }

    try {
      await toast.promise(
        type === 'subdomain'
          ? apiClient.removeSubDomain?.(seller.id)
          : apiClient.removeCustomDomain?.(seller.id),
        {
          loading: `Removing ${type}...`,
          success: `${type === 'subdomain' ? 'Subdomain' : 'Custom domain'} removed successfully`,
          error: (err) => err.message || `Failed to remove ${type}`,
        }
      );
      await fetchSellers();
    } catch (err: any) {
      console.error(`Error removing ${type}:`, err);
    }
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']} showAccessDenied={true}>
      <AdminLayout>
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Domain Management</h1>
          <p className="text-gray-600 mt-2">Manage subdomains and custom domains for all sellers</p>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        )}

        {!loading && sellers.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
            <p className="text-gray-500 text-lg">No sellers found</p>
          </div>
        )}

        {!loading && sellers.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Seller
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Subdomain
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Custom Domain
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sellers.map((seller) => (
                    <tr key={seller.id} className="hover:bg-gray-50">
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{seller.storeName}</div>
                          <div className="text-sm text-gray-500">{seller.user.email}</div>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                          {seller.sellerType}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        {seller.subDomain ? (
                          <div>
                            <div className="text-sm text-gray-900">
                              {seller.subDomain}.houseofspells.com
                            </div>
                            <button
                              onClick={() => handleRemoveDomain(seller, 'subdomain')}
                              className="text-xs text-red-600 hover:text-red-800 mt-1"
                            >
                              Remove
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedSeller(seller);
                              handleGenerateSubDomain();
                            }}
                            className="text-sm text-purple-600 hover:text-purple-800"
                          >
                            Generate
                          </button>
                        )}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        {seller.customDomain ? (
                          <div>
                            <div className="text-sm text-gray-900">{seller.customDomain}</div>
                            <div className="text-xs text-gray-500">
                              {seller.domainPackagePurchased ? 'Package Purchased' : 'Pending'}
                            </div>
                            <button
                              onClick={() => handleRemoveDomain(seller, 'custom')}
                              className="text-xs text-red-600 hover:text-red-800 mt-1"
                            >
                              Remove
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedSeller(seller);
                              setShowCustomDomainModal(true);
                            }}
                            className="text-sm text-purple-600 hover:text-purple-800"
                          >
                            Configure
                          </button>
                        )}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          {seller.subDomain && (
                            <button
                              onClick={() => {
                                setSelectedSeller(seller);
                                setSubDomainForm({ subDomain: seller.subDomain || '' });
                                setShowSubDomainModal(true);
                              }}
                              className="text-purple-600 hover:text-purple-900"
                            >
                              Edit
                            </button>
                          )}
                          {seller.customDomain && (
                            <button
                              onClick={() => {
                                setSelectedSeller(seller);
                                setCustomDomainForm({
                                  customDomain: seller.customDomain || '',
                                  domainPackagePurchased: seller.domainPackagePurchased,
                                });
                                setShowCustomDomainModal(true);
                              }}
                              className="text-purple-600 hover:text-purple-900"
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Subdomain Modal */}
        {showSubDomainModal && selectedSeller && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-lg max-w-md w-full my-4">
              <div className="p-4 sm:p-6">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-2xl font-bold">Configure Subdomain</h2>
                  <button
                    onClick={() => setShowSubDomainModal(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Subdomain
                    </label>
                    <div className="flex items-center">
                      <input
                        type="text"
                        value={subDomainForm.subDomain}
                        onChange={(e) =>
                          setSubDomainForm({ subDomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })
                        }
                        placeholder="store-name"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-purple-500"
                      />
                      <span className="px-4 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg text-gray-600">
                        .houseofspells.com
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Only lowercase letters, numbers, and hyphens allowed
                    </p>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={handleAssignSubDomain}
                      disabled={actionLoading || !subDomainForm.subDomain}
                      className="flex-1 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50"
                    >
                      {actionLoading ? 'Saving...' : 'Save Subdomain'}
                    </button>
                    <button
                      onClick={() => setShowSubDomainModal(false)}
                      disabled={actionLoading}
                      className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Custom Domain Modal */}
        {showCustomDomainModal && selectedSeller && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-lg max-w-md w-full my-4">
              <div className="p-4 sm:p-6">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-2xl font-bold">Configure Custom Domain</h2>
                  <button
                    onClick={() => setShowCustomDomainModal(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Custom Domain
                    </label>
                    <input
                      type="text"
                      value={customDomainForm.customDomain}
                      onChange={(e) =>
                        setCustomDomainForm({ ...customDomainForm, customDomain: e.target.value })
                      }
                      placeholder="example.com"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Enter the full domain name (e.g., mystore.com)
                    </p>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="packagePurchased"
                      checked={customDomainForm.domainPackagePurchased}
                      onChange={(e) =>
                        setCustomDomainForm({
                          ...customDomainForm,
                          domainPackagePurchased: e.target.checked,
                        })
                      }
                      className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                    />
                    <label htmlFor="packagePurchased" className="ml-2 text-sm text-gray-700">
                      Domain package purchased
                    </label>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={handleAssignCustomDomain}
                      disabled={actionLoading || !customDomainForm.customDomain}
                      className="flex-1 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50"
                    >
                      {actionLoading ? 'Saving...' : 'Save Domain'}
                    </button>
                    <button
                      onClick={() => setShowCustomDomainModal(false)}
                      disabled={actionLoading}
                      className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </AdminLayout>
    </RouteGuard>
  );
}

