'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { DashboardLayout } from '@/components/DashboardLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

interface SellerProfile {
  id: string;
  storeName: string;
  slug: string;
  description?: string;
  logo?: string;
  country: string;
  city?: string;
  region?: string;
  timezone: string;
  verified: boolean;
  sellerType: string;
  // Business fields
  legalBusinessName?: string;
  companyName?: string;
  vatNumber?: string;
  // Bank details (masked)
  bankName?: string;
  accountHolder?: string;
  accountNumberLast4?: string;
  sortCodeLast4?: string;
  // Operations contact
  opsContactName?: string;
  opsContactEmail?: string;
  opsContactPhone?: string;
  // Warehouse address
  warehouseAddress?: {
    street: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
  };
}

export default function SellerProfilePage() {
  const toast = useToast();
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'business' | 'bank' | 'operations' | 'warehouse'>('business');
  const [editing, setEditing] = useState(false);

  // Form states
  const [businessForm, setBusinessForm] = useState({
    storeName: '',
    description: '',
    legalBusinessName: '',
    companyName: '',
    vatNumber: '',
    country: '',
    city: '',
    region: '',
    timezone: 'UTC',
  });

  const [bankForm, setBankForm] = useState({
    bankName: '',
    accountHolder: '',
    accountNumber: '',
    sortCode: '',
  });

  const [opsForm, setOpsForm] = useState({
    opsContactName: '',
    opsContactEmail: '',
    opsContactPhone: '',
  });

  const [warehouseForm, setWarehouseForm] = useState({
    street: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
  });

  const menuItems = [
    { title: 'Dashboard', href: '/seller/dashboard', icon: '📊' },
    { title: 'Profile', href: '/seller/profile', icon: '👤' },
    { title: 'Submit Product', href: '/seller/submit-product', icon: '➕' },
    { title: 'My Products', href: '/seller/products', icon: '📦' },
    { title: 'Orders', href: '/seller/orders', icon: '🛒' },
    { title: 'Submissions', href: '/seller/submissions', icon: '📝' },
  ];

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getSellerProfile();
      if (response?.data) {
        setProfile(response.data);
        // Populate forms
        setBusinessForm({
          storeName: response.data.storeName || '',
          description: response.data.description || '',
          legalBusinessName: response.data.legalBusinessName || '',
          companyName: response.data.companyName || '',
          vatNumber: response.data.vatNumber || '',
          country: response.data.country || '',
          city: response.data.city || '',
          region: response.data.region || '',
          timezone: response.data.timezone || 'UTC',
        });
        setBankForm({
          bankName: response.data.bankName || '',
          accountHolder: response.data.accountHolder || '',
          accountNumber: '', // Never pre-fill for security
          sortCode: '', // Never pre-fill for security
        });
        setOpsForm({
          opsContactName: response.data.opsContactName || '',
          opsContactEmail: response.data.opsContactEmail || '',
          opsContactPhone: response.data.opsContactPhone || '',
        });
        if (response.data.warehouseAddress) {
          setWarehouseForm(response.data.warehouseAddress);
        }
      }
    } catch (err: any) {
      console.error('Error fetching seller profile:', err);
      toast.error(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBusinessInfo = async () => {
    try {
      setSaving(true);
      await apiClient.updateSellerProfile(businessForm);
      toast.success('Business information updated');
      setEditing(false);
      await fetchProfile();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update business info');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBankDetails = async () => {
    try {
      setSaving(true);
      // Only send if user entered new values
      const bankData: any = {};
      if (bankForm.bankName) bankData.bankName = bankForm.bankName;
      if (bankForm.accountHolder) bankData.accountHolder = bankForm.accountHolder;
      if (bankForm.accountNumber) bankData.accountNumber = bankForm.accountNumber;
      if (bankForm.sortCode) bankData.sortCode = bankForm.sortCode;
      
      await apiClient.updateSellerProfile(bankData);
      toast.success('Bank details updated');
      // Clear sensitive fields after save
      setBankForm(prev => ({ ...prev, accountNumber: '', sortCode: '' }));
      await fetchProfile();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update bank details');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOpsContact = async () => {
    try {
      setSaving(true);
      await apiClient.updateSellerProfile(opsForm);
      toast.success('Operations contact updated');
      await fetchProfile();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update operations contact');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWarehouse = async () => {
    try {
      setSaving(true);
      await apiClient.updateSellerProfile({ warehouseAddress: warehouseForm });
      toast.success('Warehouse address updated');
      await fetchProfile();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update warehouse address');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <RouteGuard allowedRoles={['B2C_SELLER', 'SELLER', 'WHOLESALER', 'ADMIN']} showAccessDenied={true}>
        <DashboardLayout role="SELLER" menuItems={menuItems} title="Seller">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        </DashboardLayout>
      </RouteGuard>
    );
  }

  return (
    <RouteGuard allowedRoles={['B2C_SELLER', 'SELLER', 'WHOLESALER', 'ADMIN']} showAccessDenied={true}>
      <DashboardLayout role="SELLER" menuItems={menuItems} title="Seller">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Seller Profile</h1>
              <p className="text-gray-600 mt-1">Manage your business information and settings</p>
            </div>
            <div className="flex items-center gap-2">
              {profile?.verified ? (
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                  ✓ Verified Seller
                </span>
              ) : (
                <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                  Pending Verification
                </span>
              )}
            </div>
          </div>

          {/* Store Overview */}
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg p-6 text-white">
            <div className="flex items-center gap-4">
              {profile?.logo ? (
                <img src={profile.logo} alt={profile.storeName} className="w-16 h-16 rounded-full object-cover bg-white" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-white bg-opacity-20 flex items-center justify-center text-2xl">
                  🏪
                </div>
              )}
              <div>
                <h2 className="text-xl font-bold">{profile?.storeName}</h2>
                <p className="text-purple-100">@{profile?.slug}</p>
                <p className="text-purple-100 text-sm mt-1">{profile?.sellerType?.replace('_', ' ')}</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="flex flex-wrap border-b border-gray-200">
              {[
                { id: 'business', label: 'Business Info', icon: '🏢' },
                { id: 'bank', label: 'Bank Details', icon: '🏦' },
                { id: 'operations', label: 'Operations Contact', icon: '👥' },
                { id: 'warehouse', label: 'Warehouse', icon: '📦' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-4 sm:px-6 py-3 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-b-2 border-purple-600 text-purple-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-6">
              {/* Business Info Tab */}
              {activeTab === 'business' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Business Information</h3>
                    {!editing && (
                      <button
                        onClick={() => setEditing(true)}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                      >
                        Edit
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Store Name *</label>
                      <input
                        type="text"
                        value={businessForm.storeName}
                        onChange={(e) => setBusinessForm({ ...businessForm, storeName: e.target.value })}
                        disabled={!editing}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Legal Business Name</label>
                      <input
                        type="text"
                        value={businessForm.legalBusinessName}
                        onChange={(e) => setBusinessForm({ ...businessForm, legalBusinessName: e.target.value })}
                        disabled={!editing}
                        placeholder="Registered company name"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Trading Name</label>
                      <input
                        type="text"
                        value={businessForm.companyName}
                        onChange={(e) => setBusinessForm({ ...businessForm, companyName: e.target.value })}
                        disabled={!editing}
                        placeholder="Business trading name"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">VAT/Tax ID</label>
                      <input
                        type="text"
                        value={businessForm.vatNumber}
                        onChange={(e) => setBusinessForm({ ...businessForm, vatNumber: e.target.value })}
                        disabled={!editing}
                        placeholder="GB123456789"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Country *</label>
                      <select
                        value={businessForm.country}
                        onChange={(e) => setBusinessForm({ ...businessForm, country: e.target.value })}
                        disabled={!editing}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                      >
                        <option value="">Select country</option>
                        <option value="United Kingdom">United Kingdom</option>
                        <option value="United States">United States</option>
                        <option value="Germany">Germany</option>
                        <option value="France">France</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                      <input
                        type="text"
                        value={businessForm.city}
                        onChange={(e) => setBusinessForm({ ...businessForm, city: e.target.value })}
                        disabled={!editing}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Store Description</label>
                      <textarea
                        value={businessForm.description}
                        onChange={(e) => setBusinessForm({ ...businessForm, description: e.target.value })}
                        disabled={!editing}
                        rows={3}
                        placeholder="Describe your store..."
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                      />
                    </div>
                  </div>

                  {editing && (
                    <div className="flex gap-3">
                      <button
                        onClick={handleSaveBusinessInfo}
                        disabled={saving}
                        className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                      >
                        {saving ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button
                        onClick={() => {
                          setEditing(false);
                          fetchProfile();
                        }}
                        className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Bank Details Tab */}
              {activeTab === 'bank' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold">Bank Details</h3>
                    <p className="text-sm text-gray-500 mt-1">Your payment information is securely encrypted</p>
                  </div>

                  {profile?.accountNumberLast4 && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-green-800 text-sm">
                        ✓ Bank account ending in ****{profile.accountNumberLast4} is configured
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                      <input
                        type="text"
                        value={bankForm.bankName}
                        onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })}
                        placeholder="e.g., Barclays, HSBC"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Account Holder Name</label>
                      <input
                        type="text"
                        value={bankForm.accountHolder}
                        onChange={(e) => setBankForm({ ...bankForm, accountHolder: e.target.value })}
                        placeholder="Name on the account"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                      <input
                        type="password"
                        value={bankForm.accountNumber}
                        onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value })}
                        placeholder="Enter new account number to update"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Sort Code / Routing Number</label>
                      <input
                        type="password"
                        value={bankForm.sortCode}
                        onChange={(e) => setBankForm({ ...bankForm, sortCode: e.target.value })}
                        placeholder="Enter new sort code to update"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleSaveBankDetails}
                      disabled={saving}
                      className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Update Bank Details'}
                    </button>
                  </div>
                </div>
              )}

              {/* Operations Contact Tab */}
              {activeTab === 'operations' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold">Operations Contact</h3>
                    <p className="text-sm text-gray-500 mt-1">Contact person for order fulfillment and operations</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
                      <input
                        type="text"
                        value={opsForm.opsContactName}
                        onChange={(e) => setOpsForm({ ...opsForm, opsContactName: e.target.value })}
                        placeholder="Operations manager name"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
                      <input
                        type="email"
                        value={opsForm.opsContactEmail}
                        onChange={(e) => setOpsForm({ ...opsForm, opsContactEmail: e.target.value })}
                        placeholder="operations@yourstore.com"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
                      <input
                        type="tel"
                        value={opsForm.opsContactPhone}
                        onChange={(e) => setOpsForm({ ...opsForm, opsContactPhone: e.target.value })}
                        placeholder="+44 123 456 7890"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleSaveOpsContact}
                      disabled={saving}
                      className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save Contact'}
                    </button>
                  </div>
                </div>
              )}

              {/* Warehouse Tab */}
              {activeTab === 'warehouse' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold">Warehouse / Return Address</h3>
                    <p className="text-sm text-gray-500 mt-1">Address for product pickups and customer returns</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                      <input
                        type="text"
                        value={warehouseForm.street}
                        onChange={(e) => setWarehouseForm({ ...warehouseForm, street: e.target.value })}
                        placeholder="Warehouse street address"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                      <input
                        type="text"
                        value={warehouseForm.city}
                        onChange={(e) => setWarehouseForm({ ...warehouseForm, city: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">State/Province</label>
                      <input
                        type="text"
                        value={warehouseForm.state}
                        onChange={(e) => setWarehouseForm({ ...warehouseForm, state: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                      <input
                        type="text"
                        value={warehouseForm.postalCode}
                        onChange={(e) => setWarehouseForm({ ...warehouseForm, postalCode: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                      <select
                        value={warehouseForm.country}
                        onChange={(e) => setWarehouseForm({ ...warehouseForm, country: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value="">Select country</option>
                        <option value="United Kingdom">United Kingdom</option>
                        <option value="United States">United States</option>
                        <option value="Germany">Germany</option>
                        <option value="France">France</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleSaveWarehouse}
                      disabled={saving}
                      className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save Warehouse Address'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DashboardLayout>
    </RouteGuard>
  );
}
