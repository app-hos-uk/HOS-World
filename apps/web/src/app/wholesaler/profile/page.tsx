'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { DashboardLayout } from '@/components/DashboardLayout';
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

interface WholesalerProfile {
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
  legalBusinessName?: string;
  companyName?: string;
  vatNumber?: string;
  bankName?: string;
  accountHolder?: string;
  accountNumberLast4?: string;
  sortCodeLast4?: string;
  opsContactName?: string;
  opsContactEmail?: string;
  opsContactPhone?: string;
  warehouseAddress?: {
    street: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
  };
}

export default function WholesalerProfilePage() {
  const toast = useToast();
  const [profile, setProfile] = useState<WholesalerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'business' | 'bank' | 'operations' | 'warehouse' | 'verification'>('business');
  const [editing, setEditing] = useState(false);

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

  // Verification tab state
  interface VerificationDocument {
    id: string;
    documentType: string;
    fileUrl: string;
    fileName?: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    reviewNotes?: string;
    createdAt: string;
    reviewedAt?: string;
  }

  const DOCUMENT_TYPES = [
    { label: 'Business License', value: 'BUSINESS_LICENSE' },
    { label: 'Tax Registration', value: 'TAX_REGISTRATION' },
    { label: 'Identity Proof', value: 'IDENTITY_PROOF' },
    { label: 'Address Proof', value: 'ADDRESS_PROOF' },
    { label: 'Other', value: 'OTHER' },
  ] as const;

  const [verificationDocs, setVerificationDocs] = useState<VerificationDocument[]>([]);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [docType, setDocType] = useState<string>('BUSINESS_LICENSE');
  const [uploadMode, setUploadMode] = useState<'file' | 'url'>('file');
  const [manualUrl, setManualUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submittingDoc, setSubmittingDoc] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  const menuItems = getSellerMenuItems(true);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getSellerProfile();
      if (response?.data) {
        setProfile(response.data);
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
          accountNumber: '',
          sortCode: '',
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
      console.error('Error fetching wholesaler profile:', err);
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
      const bankData: any = {};
      if (bankForm.bankName) bankData.bankName = bankForm.bankName;
      if (bankForm.accountHolder) bankData.accountHolder = bankForm.accountHolder;
      if (bankForm.accountNumber) bankData.accountNumber = bankForm.accountNumber;
      if (bankForm.sortCode) bankData.sortCode = bankForm.sortCode;

      await apiClient.updateSellerProfile(bankData);
      toast.success('Bank details updated');
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

  const fetchVerificationDocs = async () => {
    try {
      setVerificationLoading(true);
      const response = await apiClient.getVerificationDocuments();
      setVerificationDocs(response?.data || []);
    } catch (err: any) {
      console.error('Error fetching verification documents:', err);
      toast.error(err.message || 'Failed to load verification documents');
    } finally {
      setVerificationLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'verification') {
      fetchVerificationDocs();
    }
  }, [activeTab]);

  const handleSubmitDocument = async () => {
    let fileUrl = '';
    let fileName = '';

    if (uploadMode === 'file') {
      if (!selectedFile) {
        toast.error('Please select a file to upload');
        return;
      }
      try {
        setUploadingFile(true);
        const uploadResult = await apiClient.uploadSingleFile(selectedFile, 'verification');
        fileUrl = uploadResult?.data?.url || '';
        fileName = selectedFile.name;
        if (!fileUrl) {
          toast.error('Upload succeeded but no URL returned');
          return;
        }
      } catch (err: any) {
        toast.error(err.message || 'File upload failed');
        return;
      } finally {
        setUploadingFile(false);
      }
    } else {
      if (!manualUrl.trim()) {
        toast.error('Please enter a document URL');
        return;
      }
      fileUrl = manualUrl.trim();
      try {
        fileName = new URL(fileUrl).pathname.split('/').pop() || 'document';
      } catch {
        fileName = 'document';
      }
    }

    try {
      setSubmittingDoc(true);
      await apiClient.submitVerificationDocument({
        documentType: docType,
        fileUrl,
        fileName,
      });
      toast.success('Document submitted for verification');
      setSelectedFile(null);
      setManualUrl('');
      setDocType('BUSINESS_LICENSE');
      const fileInput = document.getElementById('verification-file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      await fetchVerificationDocs();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit document');
    } finally {
      setSubmittingDoc(false);
    }
  };

  const handleResubmit = (doc: VerificationDocument) => {
    setDocType(doc.documentType);
    setUploadMode('file');
    setSelectedFile(null);
    setManualUrl('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const formatDocType = (type: string) => {
    return DOCUMENT_TYPES.find((d) => d.value === type)?.label || type.replace(/_/g, ' ');
  };

  if (loading) {
    return (
      <RouteGuard allowedRoles={['WHOLESALER', 'ADMIN']} showAccessDenied={true}>
        <DashboardLayout role="WHOLESALER" menuItems={menuItems} title="Wholesaler" backToHref={{ title: 'Admin Dashboard', href: '/admin/dashboard' }}>
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-hos-gold"></div>
          </div>
        </DashboardLayout>
      </RouteGuard>
    );
  }

  return (
    <RouteGuard allowedRoles={['WHOLESALER', 'ADMIN']} showAccessDenied={true}>
      <DashboardLayout role="WHOLESALER" menuItems={menuItems} title="Wholesaler" backToHref={{ title: 'Admin Dashboard', href: '/admin/dashboard' }}>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-hos-text-secondary">Wholesaler Profile</h1>
              <p className="text-hos-text-secondary mt-1">Manage your wholesale business information and settings</p>
            </div>
            <div className="flex items-center gap-2">
              {profile?.verified ? (
                <span className="px-3 py-1 bg-green-500/15 text-green-300 rounded-full text-sm font-medium">
                  ✓ Verified Wholesaler
                </span>
              ) : (
                <span className="px-3 py-1 bg-yellow-500/15 text-yellow-300 rounded-full text-sm font-medium">
                  Pending Verification
                </span>
              )}
            </div>
          </div>

          <div className="bg-hos-bg-secondary border border-hos-border rounded-lg p-6 text-hos-text-secondary">
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

          <div className="bg-hos-bg-secondary border border-hos-border rounded-lg">
            <div className="flex flex-wrap border-b border-hos-border">
              {[
                { id: 'business', label: 'Business Info', icon: '🏢' },
                { id: 'bank', label: 'Bank Details', icon: '🏦' },
                { id: 'operations', label: 'Operations Contact', icon: '👥' },
                { id: 'warehouse', label: 'Warehouse', icon: '📦' },
                { id: 'verification', label: 'Verification', icon: '✓' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-4 sm:px-6 py-3 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-b-2 border-hos-gold text-hos-gold'
                      : 'text-hos-text-secondary hover:text-hos-gold'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-6">
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
                        className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold focus:outline-none disabled:bg-hos-bg-tertiary disabled:text-hos-text-muted"
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
                        className={`w-full px-4 py-2 border rounded-lg bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:ring-2 focus:ring-hos-gold/50 focus:outline-none disabled:bg-hos-bg-tertiary disabled:text-hos-text-muted ${isLabelInvalid(businessForm.legalBusinessName) ? 'border-red-500/40 focus:border-red-500 focus:ring-red-200' : 'border-hos-border focus:border-hos-gold'}`}
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
                        className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold focus:outline-none disabled:bg-hos-bg-tertiary disabled:text-hos-text-muted"
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
                        className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold focus:outline-none disabled:bg-hos-bg-tertiary disabled:text-hos-text-muted"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">Country *</label>
                      <select
                        value={businessForm.country}
                        onChange={(e) => setBusinessForm({ ...businessForm, country: e.target.value })}
                        disabled={!editing}
                        className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold focus:outline-none disabled:bg-hos-bg-tertiary disabled:text-hos-text-muted"
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
                        className={`w-full px-4 py-2 border rounded-lg bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:ring-2 focus:ring-hos-gold/50 focus:outline-none disabled:bg-hos-bg-tertiary disabled:text-hos-text-muted ${isLabelInvalid(businessForm.city) ? 'border-red-500/40 focus:border-red-500 focus:ring-red-200' : 'border-hos-border focus:border-hos-gold'}`}
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
                        placeholder="Describe your wholesale business..."
                        className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold focus:outline-none disabled:bg-hos-bg-tertiary disabled:text-hos-text-muted"
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
                        className={`w-full px-4 py-2 border rounded-lg bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:ring-2 focus:ring-hos-gold/50 focus:outline-none ${isLabelInvalid(bankForm.bankName) ? 'border-red-500/40 focus:border-red-500 focus:ring-red-200' : 'border-hos-border focus:border-hos-gold'}`}
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
                        className={`w-full px-4 py-2 border rounded-lg bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:ring-2 focus:ring-hos-gold/50 focus:outline-none ${isLabelInvalid(bankForm.accountHolder) ? 'border-red-500/40 focus:border-red-500 focus:ring-red-200' : 'border-hos-border focus:border-hos-gold'}`}
                      />
                      {isLabelInvalid(bankForm.accountHolder) && (
                        <p className="text-xs text-red-400 mt-1">Must include at least one letter</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">Account Number</label>
                      <input
                        type="password"
                        value={bankForm.accountNumber}
                        onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value })}
                        placeholder="Enter new account number to update"
                        className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">Sort Code / Routing Number</label>
                      <input
                        type="password"
                        value={bankForm.sortCode}
                        onChange={(e) => setBankForm({ ...bankForm, sortCode: e.target.value })}
                        placeholder="Enter new sort code to update"
                        className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold focus:outline-none"
                      />
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
                        className={`w-full px-4 py-2 border rounded-lg bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:ring-2 focus:ring-hos-gold/50 focus:outline-none ${isLabelInvalid(opsForm.opsContactName) ? 'border-red-500/40 focus:border-red-500 focus:ring-red-200' : 'border-hos-border focus:border-hos-gold'}`}
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
                        className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold focus:outline-none"
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
                        className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold focus:outline-none"
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
                        className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">City</label>
                      <input
                        type="text"
                        value={warehouseForm.city}
                        onChange={(e) => setWarehouseForm({ ...warehouseForm, city: sanitizeLabelInput(e.target.value, warehouseForm.city) })}
                        className={`w-full px-4 py-2 border rounded-lg bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:ring-2 focus:ring-hos-gold/50 focus:outline-none ${isLabelInvalid(warehouseForm.city) ? 'border-red-500/40 focus:border-red-500 focus:ring-red-200' : 'border-hos-border focus:border-hos-gold'}`}
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
                        className={`w-full px-4 py-2 border rounded-lg bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:ring-2 focus:ring-hos-gold/50 focus:outline-none ${isLabelInvalid(warehouseForm.state) ? 'border-red-500/40 focus:border-red-500 focus:ring-red-200' : 'border-hos-border focus:border-hos-gold'}`}
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
                        className={`w-full px-4 py-2 border rounded-lg bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:ring-2 focus:ring-hos-gold/50 focus:outline-none ${isPostalInvalid(warehouseForm.postalCode) ? 'border-red-500/40 focus:border-red-500 focus:ring-red-200' : 'border-hos-border focus:border-hos-gold'}`}
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
                        className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold focus:outline-none"
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

              {activeTab === 'verification' && (
                <div className="space-y-6">
                  {/* Verification Status Banner */}
                  {profile?.verified ? (
                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 flex items-center gap-3">
                      <span className="text-green-400 text-xl">&#10003;</span>
                      <div>
                        <p className="font-medium text-green-300">Your account is verified</p>
                        <p className="text-sm text-green-400/70 mt-0.5">Your wholesaler account has been reviewed and approved.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex items-center gap-3">
                      <span className="text-yellow-400 text-xl">&#9888;</span>
                      <div>
                        <p className="font-medium text-yellow-300">Your account is pending verification</p>
                        <p className="text-sm text-yellow-400/70 mt-0.5">Please submit the required documents below.</p>
                      </div>
                    </div>
                  )}

                  {/* Document Submission Form */}
                  <div className="bg-hos-bg-tertiary border border-hos-border rounded-lg p-5">
                    <h3 className="text-lg font-semibold mb-4">Submit Verification Document</h3>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-hos-text-secondary mb-1">Document Type</label>
                        <select
                          value={docType}
                          onChange={(e) => setDocType(e.target.value)}
                          className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold focus:outline-none"
                        >
                          {DOCUMENT_TYPES.map((dt) => (
                            <option key={dt.value} value={dt.value}>
                              {dt.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-hos-text-secondary mb-2">Upload Method</label>
                        <div className="flex gap-2 mb-3">
                          <button
                            type="button"
                            onClick={() => setUploadMode('file')}
                            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                              uploadMode === 'file'
                                ? 'bg-hos-gold text-[#1a1406]'
                                : 'bg-hos-bg-secondary border border-hos-border text-hos-text-secondary hover:bg-hos-bg-tertiary'
                            }`}
                          >
                            Upload File
                          </button>
                          <button
                            type="button"
                            onClick={() => setUploadMode('url')}
                            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                              uploadMode === 'url'
                                ? 'bg-hos-gold text-[#1a1406]'
                                : 'bg-hos-bg-secondary border border-hos-border text-hos-text-secondary hover:bg-hos-bg-tertiary'
                            }`}
                          >
                            Paste URL
                          </button>
                        </div>

                        {uploadMode === 'file' ? (
                          <div>
                            <input
                              id="verification-file-input"
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png,.webp"
                              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                              className="w-full text-sm text-hos-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-hos-gold file:text-[#1a1406] hover:file:bg-hos-gold-hover file:cursor-pointer"
                            />
                            {selectedFile && (
                              <p className="text-xs text-hos-text-muted mt-1">
                                Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                              </p>
                            )}
                          </div>
                        ) : (
                          <input
                            type="url"
                            value={manualUrl}
                            onChange={(e) => setManualUrl(e.target.value)}
                            placeholder="https://example.com/document.pdf"
                            className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold focus:outline-none"
                          />
                        )}
                      </div>

                      <button
                        onClick={handleSubmitDocument}
                        disabled={submittingDoc || uploadingFile}
                        className="px-6 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover disabled:opacity-50 font-medium"
                      >
                        {uploadingFile ? 'Uploading...' : submittingDoc ? 'Submitting...' : 'Submit Document'}
                      </button>
                    </div>
                  </div>

                  {/* Submitted Documents List */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Submitted Documents</h3>

                    {verificationLoading ? (
                      <div className="flex justify-center py-8">
                        <div className="w-8 h-8 border-4 border-hos-gold border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : verificationDocs.length === 0 ? (
                      <div className="text-center py-8 bg-hos-bg-tertiary border border-hos-border rounded-lg">
                        <p className="text-hos-text-muted">No documents submitted yet. Upload your first document above.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {verificationDocs.map((doc) => (
                          <div
                            key={doc.id}
                            className={`bg-hos-bg-tertiary border rounded-lg p-4 ${
                              doc.status === 'REJECTED' ? 'border-red-500/30' : 'border-hos-border'
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-hos-text-secondary">
                                    {formatDocType(doc.documentType)}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                                      doc.status === 'APPROVED'
                                        ? 'bg-green-900/30 text-green-400'
                                        : doc.status === 'REJECTED'
                                          ? 'bg-red-900/30 text-red-400'
                                          : 'bg-yellow-900/30 text-yellow-400'
                                    }`}
                                  >
                                    {doc.status}
                                  </span>
                                </div>
                                {doc.fileName && (
                                  <a
                                    href={doc.fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-hos-gold hover:underline inline-block"
                                  >
                                    {doc.fileName}
                                  </a>
                                )}
                                <p className="text-xs text-hos-text-muted">
                                  Submitted {new Date(doc.createdAt).toLocaleDateString(undefined, {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </p>
                                {doc.reviewNotes && (
                                  <div
                                    className={`mt-2 text-sm rounded-md p-2.5 ${
                                      doc.status === 'REJECTED'
                                        ? 'bg-red-500/10 border border-red-500/20 text-red-300'
                                        : 'bg-hos-bg-secondary text-hos-text-secondary'
                                    }`}
                                  >
                                    <span className="font-medium">Review Notes:</span> {doc.reviewNotes}
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-col gap-2 shrink-0">
                                <a
                                  href={doc.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-4 py-2 border border-hos-border rounded-lg text-sm text-hos-text-secondary hover:bg-hos-bg-secondary text-center transition-colors"
                                >
                                  View
                                </a>
                                {doc.status === 'REJECTED' && (
                                  <button
                                    type="button"
                                    onClick={() => handleResubmit(doc)}
                                    className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg text-sm hover:bg-hos-gold-hover font-medium"
                                  >
                                    Resubmit
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
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
