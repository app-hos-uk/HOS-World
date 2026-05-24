'use client';

import { useEffect, useState, useMemo } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';
import { getSellerMenuItems } from '@/lib/sellerMenu';
import { useToast } from '@/hooks/useToast';
import { SafeImage } from '@/components/SafeImage';
import {
  optionalLabelRequiresLettersOk,
  optionalPhoneOk,
  optionalPostalCodeOk,
  sanitizeOpsPhoneInput,
  sanitizePostalInput,
  sanitizeLabelInput,
  isLabelInvalid,
  isPostalInvalid,
  SELLER_PROFILE_HINTS,
} from '@/lib/sellerProfileFieldValidation';

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
  const { user, effectiveRole } = useAuth();
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

  // Visibility toggles for sensitive bank fields
  const [showAccountNumber, setShowAccountNumber] = useState(false);
  const [showSortCode, setShowSortCode] = useState(false);

  const currentRole = effectiveRole || user?.role;
  const isWholesaler = currentRole === 'WHOLESALER';
  const menuItems = useMemo(() => getSellerMenuItems(isWholesaler), [isWholesaler]);

  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (!optionalLabelRequiresLettersOk(businessForm.legalBusinessName)) {
      toast.error(SELLER_PROFILE_HINTS.labelLetters('Legal business name'));
      return;
    }
    if (!optionalLabelRequiresLettersOk(businessForm.city)) {
      toast.error(SELLER_PROFILE_HINTS.labelLetters('City'));
      return;
    }
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
    if (bankForm.bankName.trim() && !optionalLabelRequiresLettersOk(bankForm.bankName)) {
      toast.error(SELLER_PROFILE_HINTS.labelLetters('Bank name'));
      return;
    }
    if (bankForm.accountHolder.trim() && !optionalLabelRequiresLettersOk(bankForm.accountHolder)) {
      toast.error(SELLER_PROFILE_HINTS.labelLetters('Account holder name'));
      return;
    }
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
    if (!optionalLabelRequiresLettersOk(opsForm.opsContactName)) {
      toast.error(SELLER_PROFILE_HINTS.labelLetters('Contact name'));
      return;
    }
    if (!optionalPhoneOk(opsForm.opsContactPhone)) {
      toast.error(SELLER_PROFILE_HINTS.phone);
      return;
    }
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
    if (!optionalLabelRequiresLettersOk(warehouseForm.city)) {
      toast.error(SELLER_PROFILE_HINTS.labelLetters('City'));
      return;
    }
    if (!optionalLabelRequiresLettersOk(warehouseForm.state)) {
      toast.error(SELLER_PROFILE_HINTS.labelLetters('State'));
      return;
    }
    if (!optionalPostalCodeOk(warehouseForm.postalCode)) {
      toast.error(SELLER_PROFILE_HINTS.postal);
      return;
    }
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
        <DashboardLayout
          role={isWholesaler ? 'WHOLESALER' : 'SELLER'}
          menuItems={menuItems}
          title={isWholesaler ? 'Wholesaler' : 'Seller'}
        >
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-hos-gold"></div>
          </div>
        </DashboardLayout>
      </RouteGuard>
    );
  }

  return (
    <RouteGuard allowedRoles={['B2C_SELLER', 'SELLER', 'WHOLESALER', 'ADMIN']} showAccessDenied={true}>
      <DashboardLayout
        role={isWholesaler ? 'WHOLESALER' : 'SELLER'}
        menuItems={menuItems}
        title={isWholesaler ? 'Wholesaler' : 'Seller'}
      >
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">Seller Profile</h1>
              <p className="text-hos-text-secondary mt-1">Manage your business information and settings</p>
            </div>
            <div className="flex items-center gap-2">
              {profile?.verified ? (
                <span className="px-3 py-1 bg-green-500/15 text-green-300 rounded-full text-sm font-medium">
                  ✓ Verified Seller
                </span>
              ) : (
                <span className="px-3 py-1 bg-yellow-500/15 text-yellow-300 rounded-full text-sm font-medium">
                  Pending Verification
                </span>
              )}
            </div>
          </div>

          {/* Store Overview */}
          <div className="bg-hos-bg-secondary border border-hos-border rounded-lg p-6 text-white">
            <div className="flex items-center gap-4">
              {profile?.logo ? (
                <SafeImage src={profile.logo} alt={profile.storeName ?? ''} width={64} height={64} className="rounded-full object-cover bg-hos-bg-secondary" fallback="🏪" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-hos-bg-secondary bg-opacity-20 flex items-center justify-center text-2xl">
                  🏪
                </div>
              )}
              <div>
                <h2 className="text-xl font-bold">{profile?.storeName}</h2>
                <p className="text-hos-text-secondary">@{profile?.slug}</p>
                <p className="text-hos-text-secondary text-sm mt-1">{profile?.sellerType?.replace('_', ' ')}</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-hos-bg-secondary border border-hos-border rounded-lg">
            <div className="flex flex-wrap border-b border-hos-border">
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
                      ? 'border-b-2 border-hos-gold text-hos-gold'
                      : 'text-hos-text-secondary hover:text-white'
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
                        className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover text-sm"
                      >
                        Edit
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">Store Name *</label>
                      <input
                        type="text"
                        value={businessForm.storeName}
                        onChange={(e) => setBusinessForm({ ...businessForm, storeName: e.target.value })}
                        disabled={!editing}
                        className="w-full px-4 py-2 border border-hos-border rounded-lg disabled:bg-hos-bg-tertiary"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">Legal Business Name</label>
                      <input
                        type="text"
                        value={businessForm.legalBusinessName}
                        onChange={(e) => setBusinessForm({ ...businessForm, legalBusinessName: sanitizeLabelInput(e.target.value, businessForm.legalBusinessName) })}
                        disabled={!editing}
                        placeholder="Registered company name"
                        className={`w-full px-4 py-2 border rounded-lg disabled:bg-hos-bg-tertiary ${isLabelInvalid(businessForm.legalBusinessName) ? 'border-red-500/40 focus:border-red-500 focus:ring-red-200' : 'border-hos-border'}`}
                      />
                      {isLabelInvalid(businessForm.legalBusinessName) && (
                        <p className="text-xs text-red-400 mt-1">Must include at least one letter</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">Trading Name</label>
                      <input
                        type="text"
                        value={businessForm.companyName}
                        onChange={(e) => setBusinessForm({ ...businessForm, companyName: e.target.value })}
                        disabled={!editing}
                        placeholder="Business trading name"
                        className="w-full px-4 py-2 border border-hos-border rounded-lg disabled:bg-hos-bg-tertiary"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">Tax ID / EIN</label>
                      <input
                        type="text"
                        value={businessForm.vatNumber}
                        onChange={(e) => setBusinessForm({ ...businessForm, vatNumber: e.target.value })}
                        disabled={!editing}
                        placeholder="12-3456789"
                        className="w-full px-4 py-2 border border-hos-border rounded-lg disabled:bg-hos-bg-tertiary"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">Country *</label>
                      <select
                        value={businessForm.country}
                        onChange={(e) => setBusinessForm({ ...businessForm, country: e.target.value })}
                        disabled={!editing}
                        className="w-full px-4 py-2 border border-hos-border rounded-lg disabled:bg-hos-bg-tertiary"
                      >
                        <option value="">Select country</option>
                        <option value="United States">United States</option>
                        <option value="Germany">Germany</option>
                        <option value="France">France</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">City</label>
                      <input
                        type="text"
                        value={businessForm.city}
                        onChange={(e) => setBusinessForm({ ...businessForm, city: sanitizeLabelInput(e.target.value, businessForm.city) })}
                        disabled={!editing}
                        className={`w-full px-4 py-2 border rounded-lg disabled:bg-hos-bg-tertiary ${isLabelInvalid(businessForm.city) ? 'border-red-500/40 focus:border-red-500 focus:ring-red-200' : 'border-hos-border'}`}
                      />
                      {isLabelInvalid(businessForm.city) && (
                        <p className="text-xs text-red-400 mt-1">Must include at least one letter</p>
                      )}
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">Store Description</label>
                      <textarea
                        value={businessForm.description}
                        onChange={(e) => setBusinessForm({ ...businessForm, description: e.target.value })}
                        disabled={!editing}
                        rows={3}
                        placeholder="Describe your store..."
                        className="w-full px-4 py-2 border border-hos-border rounded-lg disabled:bg-hos-bg-tertiary"
                      />
                    </div>
                  </div>

                  {editing && (
                    <div className="flex gap-3">
                      <button
                        onClick={handleSaveBusinessInfo}
                        disabled={saving}
                        className="px-6 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover disabled:opacity-50"
                      >
                        {saving ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button
                        onClick={() => {
                          setEditing(false);
                          fetchProfile();
                        }}
                        className="px-6 py-2 bg-hos-bg-tertiary text-hos-text-secondary rounded-lg hover:bg-hos-bg-tertiary"
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
                    <p className="text-sm text-hos-text-muted mt-1">Your payment information is securely encrypted</p>
                  </div>

                  {profile?.accountNumberLast4 && (
                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                      <p className="text-green-300 text-sm">
                        ✓ Bank account ending in ****{profile.accountNumberLast4} is configured
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">Bank Name</label>
                      <input
                        type="text"
                        value={bankForm.bankName}
                        onChange={(e) => setBankForm({ ...bankForm, bankName: sanitizeLabelInput(e.target.value, bankForm.bankName) })}
                        placeholder="e.g., Barclays, HSBC"
                        className={`w-full px-4 py-2 border rounded-lg ${isLabelInvalid(bankForm.bankName) ? 'border-red-500/40 focus:border-red-500 focus:ring-red-200' : 'border-hos-border'}`}
                      />
                      {isLabelInvalid(bankForm.bankName) && (
                        <p className="text-xs text-red-400 mt-1">Must include at least one letter</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">Account Holder Name</label>
                      <input
                        type="text"
                        value={bankForm.accountHolder}
                        onChange={(e) => setBankForm({ ...bankForm, accountHolder: sanitizeLabelInput(e.target.value, bankForm.accountHolder) })}
                        placeholder="Name on the account"
                        className={`w-full px-4 py-2 border rounded-lg ${isLabelInvalid(bankForm.accountHolder) ? 'border-red-500/40 focus:border-red-500 focus:ring-red-200' : 'border-hos-border'}`}
                      />
                      {isLabelInvalid(bankForm.accountHolder) && (
                        <p className="text-xs text-red-400 mt-1">Must include at least one letter</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">Account Number</label>
                      <div className="relative">
                        <input
                          type={showAccountNumber ? 'text' : 'password'}
                          value={bankForm.accountNumber}
                          onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value })}
                          placeholder="Enter new account number to update"
                          className="w-full px-4 py-2 pr-12 border border-hos-border rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => setShowAccountNumber(!showAccountNumber)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-hos-text-muted hover:text-hos-text-secondary focus:outline-none"
                          aria-label={showAccountNumber ? 'Hide account number' : 'Show account number'}
                        >
                          {showAccountNumber ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">Sort Code / Routing Number</label>
                      <div className="relative">
                        <input
                          type={showSortCode ? 'text' : 'password'}
                          value={bankForm.sortCode}
                          onChange={(e) => setBankForm({ ...bankForm, sortCode: e.target.value })}
                          placeholder="Enter new sort code to update"
                          className="w-full px-4 py-2 pr-12 border border-hos-border rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSortCode(!showSortCode)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-hos-text-muted hover:text-hos-text-secondary focus:outline-none"
                          aria-label={showSortCode ? 'Hide sort code' : 'Show sort code'}
                        >
                          {showSortCode ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleSaveBankDetails}
                      disabled={saving}
                      className="px-6 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover disabled:opacity-50"
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
                    <p className="text-sm text-hos-text-muted mt-1">Contact person for order fulfillment and operations</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">Contact Name</label>
                      <input
                        type="text"
                        value={opsForm.opsContactName}
                        onChange={(e) => setOpsForm({ ...opsForm, opsContactName: sanitizeLabelInput(e.target.value, opsForm.opsContactName) })}
                        placeholder="Operations manager name"
                        className={`w-full px-4 py-2 border rounded-lg ${isLabelInvalid(opsForm.opsContactName) ? 'border-red-500/40 focus:border-red-500 focus:ring-red-200' : 'border-hos-border'}`}
                      />
                      {isLabelInvalid(opsForm.opsContactName) && (
                        <p className="text-xs text-red-400 mt-1">Must include at least one letter</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">Contact Email</label>
                      <input
                        type="email"
                        value={opsForm.opsContactEmail}
                        onChange={(e) => setOpsForm({ ...opsForm, opsContactEmail: e.target.value })}
                        placeholder="operations@yourstore.com"
                        className="w-full px-4 py-2 border border-hos-border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">Contact Phone</label>
                      <input
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        value={opsForm.opsContactPhone}
                        onChange={(e) =>
                          setOpsForm({
                            ...opsForm,
                            opsContactPhone: sanitizeOpsPhoneInput(e.target.value),
                          })
                        }
                        placeholder="+1 555 123 4567"
                        className="w-full px-4 py-2 border border-hos-border rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleSaveOpsContact}
                      disabled={saving}
                      className="px-6 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover disabled:opacity-50"
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
                    <p className="text-sm text-hos-text-muted mt-1">Address for product pickups and customer returns</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">Street Address</label>
                      <input
                        type="text"
                        value={warehouseForm.street}
                        onChange={(e) => setWarehouseForm({ ...warehouseForm, street: e.target.value })}
                        placeholder="Warehouse street address"
                        className="w-full px-4 py-2 border border-hos-border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">City</label>
                      <input
                        type="text"
                        value={warehouseForm.city}
                        onChange={(e) => setWarehouseForm({ ...warehouseForm, city: sanitizeLabelInput(e.target.value, warehouseForm.city) })}
                        className={`w-full px-4 py-2 border rounded-lg ${isLabelInvalid(warehouseForm.city) ? 'border-red-500/40 focus:border-red-500 focus:ring-red-200' : 'border-hos-border'}`}
                      />
                      {isLabelInvalid(warehouseForm.city) && (
                        <p className="text-xs text-red-400 mt-1">Must include at least one letter</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">State/Province</label>
                      <input
                        type="text"
                        value={warehouseForm.state}
                        onChange={(e) => setWarehouseForm({ ...warehouseForm, state: sanitizeLabelInput(e.target.value, warehouseForm.state) })}
                        className={`w-full px-4 py-2 border rounded-lg ${isLabelInvalid(warehouseForm.state) ? 'border-red-500/40 focus:border-red-500 focus:ring-red-200' : 'border-hos-border'}`}
                      />
                      {isLabelInvalid(warehouseForm.state) && (
                        <p className="text-xs text-red-400 mt-1">Must include at least one letter</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">Postal Code</label>
                      <input
                        type="text"
                        inputMode="text"
                        autoComplete="postal-code"
                        value={warehouseForm.postalCode}
                        onChange={(e) =>
                          setWarehouseForm({
                            ...warehouseForm,
                            postalCode: sanitizePostalInput(e.target.value),
                          })
                        }
                        className={`w-full px-4 py-2 border rounded-lg ${isPostalInvalid(warehouseForm.postalCode) ? 'border-red-500/40 focus:border-red-500 focus:ring-red-200' : 'border-hos-border'}`}
                      />
                      {isPostalInvalid(warehouseForm.postalCode) && (
                        <p className="text-xs text-red-400 mt-1">Must include at least one digit</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">Country</label>
                      <select
                        value={warehouseForm.country}
                        onChange={(e) => setWarehouseForm({ ...warehouseForm, country: e.target.value })}
                        className="w-full px-4 py-2 border border-hos-border rounded-lg"
                      >
                        <option value="">Select country</option>
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
                      className="px-6 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover disabled:opacity-50"
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
