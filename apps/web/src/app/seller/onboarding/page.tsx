'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

type OnboardingStep = 'store-info' | 'location' | 'verification' | 'payment' | 'complete';

export default function SellerOnboardingPage() {
  const router = useRouter();
  const toast = useToast();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('store-info');
  const [loading, setLoading] = useState(false);
  const [sellerProfile, setSellerProfile] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [wholesalerB2b, setWholesalerB2b] = useState({
    companyName: '',
    vatNumber: '',
    businessRegNumber: '',
    businessType: '',
  });

  // Form state
  const [storeInfo, setStoreInfo] = useState({
    storeName: '',
    description: '',
    logo: '',
  });

  const [location, setLocation] = useState({
    country: '',
    city: '',
    region: '',
    timezone: 'UTC',
  });

  const [payment, setPayment] = useState({
    stripeConnected: false,
  });

  const [verification, setVerification] = useState({
    documentType: 'BUSINESS_LICENSE',
    fileUrl: '',
    fileName: '',
  });

  useEffect(() => {
    checkExistingProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.getCurrentUser();
        if (res?.data?.role) setUserRole(res.data.role);
        const prof = await apiClient.getProfile();
        const b2b = (prof?.data as any)?.customerProfile;
        if (b2b) {
          setWholesalerB2b({
            companyName: b2b.companyName || '',
            vatNumber: b2b.vatNumber || '',
            businessRegNumber: b2b.businessRegNumber || '',
            businessType: b2b.businessType || '',
          });
        }
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const checkExistingProfile = async () => {
    try {
      const response = await apiClient.getSellerProfile();
      if (response?.data) {
        const seller = response.data;
        setSellerProfile(seller);

        // If profile is complete, redirect to dashboard
        if (seller.storeName && seller.country && seller.verified === true) {
          router.push('/seller/dashboard');
          return;
        }

        // Pre-fill form with existing data, determine furthest completed step
        if (seller.storeName) {
          setStoreInfo({
            storeName: seller.storeName,
            description: seller.description || '',
            logo: seller.logo || '',
          });
        }

        if (seller.country) {
          setLocation({
            country: seller.country,
            city: seller.city || '',
            region: seller.region || '',
            timezone: seller.timezone || 'UTC',
          });
        }

        if (seller.country) {
          // Route based on seller type - wholesalers need verification first
          const sellerType = String(seller.sellerType || '').toUpperCase();
          setCurrentStep(sellerType === 'WHOLESALER' ? 'verification' : 'payment');
        } else if (seller.storeName) {
          setCurrentStep('location');
        }
      }
    } catch (err: any) {
      // Profile doesn't exist yet, start from beginning
      // Profile doesn't exist yet — expected for new sellers
    }
  };

  const handleStoreInfoSubmit = async () => {
    if (!storeInfo.storeName) {
      toast.error('Store name is required');
      return;
    }

    if (userRole === 'WHOLESALER' && !wholesalerB2b.companyName?.trim()) {
      toast.error('Company name is required for wholesaler accounts');
      return;
    }

    try {
      setLoading(true);
      await apiClient.updateSellerProfile({
        storeName: storeInfo.storeName,
        description: storeInfo.description,
        logo: storeInfo.logo,
      });
      if (userRole === 'WHOLESALER') {
        await apiClient.updateProfile({
          companyName: wholesalerB2b.companyName || undefined,
          vatNumber: wholesalerB2b.vatNumber || undefined,
          businessRegNumber: wholesalerB2b.businessRegNumber || undefined,
          businessType: wholesalerB2b.businessType || undefined,
        });
      }
      toast.success('Store information saved');
      setCurrentStep('location');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save store information');
    } finally {
      setLoading(false);
    }
  };

  const handleLocationSubmit = async () => {
    if (!location.country) {
      toast.error('Country is required');
      return;
    }

    try {
      setLoading(true);
      await apiClient.updateSellerProfile({
        country: location.country,
        city: location.city,
        region: location.region,
      });
      toast.success('Location information saved');
      setCurrentStep(userRole === 'WHOLESALER' ? 'verification' : 'payment');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save location');
    } finally {
      setLoading(false);
    }
  };

  const handleVerificationSubmit = async () => {
    if (!verification.fileUrl.trim()) {
      toast.error('Please provide a document URL');
      return;
    }
    try {
      setLoading(true);
      await apiClient.submitVerificationDocument({
        documentType: verification.documentType,
        fileUrl: verification.fileUrl.trim(),
        fileName: verification.fileName.trim() || undefined,
      });
      toast.success('Verification document submitted for review');
      setCurrentStep('payment');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit document');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSubmit = async () => {
    // Payment setup can be done later, just mark as complete
    toast.success('Onboarding complete!');
    setCurrentStep('complete');
    setTimeout(() => {
      router.push('/seller/dashboard');
    }, 2000);
  };

  const baseSteps: { key: OnboardingStep; title: string; description: string }[] = [
    { key: 'store-info', title: 'Store Information', description: 'Set up your store details' },
    { key: 'location', title: 'Location', description: 'Add your business location' },
  ];
  const wholesalerSteps = userRole === 'WHOLESALER'
    ? [{ key: 'verification' as const, title: 'Verification', description: 'Upload business documents' }]
    : [];
  const tailSteps: { key: OnboardingStep; title: string; description: string }[] = [
    { key: 'payment', title: 'Payment Setup', description: 'Connect payment methods' },
    { key: 'complete', title: 'Complete', description: 'You\'re all set!' },
  ];
  const steps = [...baseSteps, ...wholesalerSteps, ...tailSteps];

  const currentStepIndex = steps.findIndex((s) => s.key === currentStep);

  return (
    <RouteGuard allowedRoles={['SELLER', 'B2C_SELLER', 'WHOLESALER', 'ADMIN']} showAccessDenied={true}>
      <div className="min-h-screen bg-hos-bg-secondary">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
          <div className="max-w-4xl mx-auto">
            {/* Progress Steps */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                {steps.map((step, index) => (
                  <div key={step.key} className="flex items-center flex-1">
                    <div className="flex flex-col items-center flex-1">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors ${
                          index <= currentStepIndex
                            ? 'bg-hos-gold text-[#1a1406]'
                            : 'bg-hos-bg-tertiary text-hos-text-secondary'
                        }`}
                      >
                        {index < currentStepIndex ? '✓' : index + 1}
                      </div>
                      <div className="mt-2 text-center hidden sm:block">
                        <div
                          className={`text-xs font-medium ${
                            index <= currentStepIndex ? 'text-hos-gold' : 'text-hos-text-muted'
                          }`}
                        >
                          {step.title}
                        </div>
                      </div>
                    </div>
                    {index < steps.length - 1 && (
                      <div
                        className={`h-1 flex-1 mx-2 transition-colors ${
                          index < currentStepIndex ? 'bg-hos-gold' : 'bg-hos-bg-tertiary'
                        }`}
                      ></div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Step Content */}
            <div className="bg-hos-bg-secondary border border-hos-border rounded-lg p-6 sm:p-8">
              {currentStep === 'store-info' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">Store Information</h2>
                    <p className="text-hos-text-secondary">Let&apos;s start by setting up your store details</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                      Store Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={storeInfo.storeName}
                      onChange={(e) => setStoreInfo({ ...storeInfo, storeName: e.target.value })}
                      placeholder="My Awesome Store"
                      className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-hos-text-secondary mb-1">Store Description</label>
                    <textarea
                      value={storeInfo.description}
                      onChange={(e) => setStoreInfo({ ...storeInfo, description: e.target.value })}
                      placeholder="Tell customers about your store..."
                      rows={4}
                      className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-hos-text-secondary mb-1">Store Logo URL</label>
                    <input
                      type="url"
                      value={storeInfo.logo}
                      onChange={(e) => setStoreInfo({ ...storeInfo, logo: e.target.value })}
                      placeholder="https://example.com/logo.png"
                      className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold focus:outline-none"
                    />
                    <p className="text-xs text-hos-text-muted mt-1">You can upload a logo later</p>
                  </div>

                  {userRole === 'WHOLESALER' && (
                    <div className="space-y-4 border-t border-hos-border pt-6">
                      <h3 className="text-lg font-semibold text-hos-text-secondary">Business details (B2B)</h3>
                      <p className="text-sm text-hos-text-secondary">
                        Used for invoicing and wholesale verification.
                      </p>
                      <div>
                        <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                          Company name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={wholesalerB2b.companyName}
                          onChange={(e) =>
                            setWholesalerB2b({ ...wholesalerB2b, companyName: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold focus:outline-none"
                          placeholder="Registered company name"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-hos-text-secondary mb-1">VAT number</label>
                          <input
                            type="text"
                            value={wholesalerB2b.vatNumber}
                            onChange={(e) =>
                              setWholesalerB2b({ ...wholesalerB2b, vatNumber: e.target.value })
                            }
                            className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                            Business registration #
                          </label>
                          <input
                            type="text"
                            value={wholesalerB2b.businessRegNumber}
                            onChange={(e) =>
                              setWholesalerB2b({ ...wholesalerB2b, businessRegNumber: e.target.value })
                            }
                            className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold focus:outline-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-hos-text-secondary mb-1">Business type</label>
                        <input
                          type="text"
                          value={wholesalerB2b.businessType}
                          onChange={(e) =>
                            setWholesalerB2b({ ...wholesalerB2b, businessType: e.target.value })
                          }
                          placeholder="e.g. DISTRIBUTOR, RETAIL"
                          className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button
                      onClick={handleStoreInfoSubmit}
                      disabled={loading || !storeInfo.storeName}
                      className="px-6 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors font-medium disabled:opacity-50"
                    >
                      {loading ? 'Saving...' : 'Continue'}
                    </button>
                  </div>
                </div>
              )}

              {currentStep === 'location' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">Business Location</h2>
                    <p className="text-hos-text-secondary">Where is your business located?</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                      Country <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={location.country}
                      onChange={(e) => setLocation({ ...location, country: e.target.value })}
                      placeholder="United States"
                      className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold focus:outline-none"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">City</label>
                      <input
                        type="text"
                        value={location.city}
                        onChange={(e) => setLocation({ ...location, city: e.target.value })}
                        placeholder="London"
                        className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">Region/State</label>
                      <input
                        type="text"
                        value={location.region}
                        onChange={(e) => setLocation({ ...location, region: e.target.value })}
                        placeholder="England"
                        className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between">
                    <button
                      onClick={() => setCurrentStep('store-info')}
                      className="px-6 py-2 bg-hos-bg-tertiary text-hos-text-secondary rounded-lg hover:bg-hos-bg-tertiary transition-colors font-medium"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleLocationSubmit}
                      disabled={loading || !location.country}
                      className="px-6 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors font-medium disabled:opacity-50"
                    >
                      {loading ? 'Saving...' : 'Continue'}
                    </button>
                  </div>
                </div>
              )}

              {currentStep === 'verification' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">Business Verification</h2>
                    <p className="text-hos-text-secondary">
                      Upload a business license or registration document for admin review
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">Document type</label>
                      <select
                        value={verification.documentType}
                        onChange={(e) => setVerification({ ...verification, documentType: e.target.value })}
                        className="w-full px-4 py-2 bg-hos-bg-tertiary border border-hos-border rounded-lg text-hos-text-secondary"
                      >
                        <option value="BUSINESS_LICENSE">Business License</option>
                        <option value="TAX_REGISTRATION">Tax Registration</option>
                        <option value="IDENTITY_PROOF">Identity Proof</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">Document URL</label>
                      <input
                        type="url"
                        value={verification.fileUrl}
                        onChange={(e) => setVerification({ ...verification, fileUrl: e.target.value })}
                        placeholder="https://example.com/your-document.pdf"
                        className="w-full px-4 py-2 bg-hos-bg-tertiary border border-hos-border rounded-lg text-hos-text-secondary"
                      />
                      <p className="text-xs text-hos-text-muted mt-1">Upload your file to cloud storage and paste the public URL here</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">File name (optional)</label>
                      <input
                        type="text"
                        value={verification.fileName}
                        onChange={(e) => setVerification({ ...verification, fileName: e.target.value })}
                        placeholder="business-license.pdf"
                        className="w-full px-4 py-2 bg-hos-bg-tertiary border border-hos-border rounded-lg text-hos-text-secondary"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between">
                    <button
                      onClick={() => setCurrentStep('location')}
                      className="px-6 py-2 bg-hos-bg-tertiary text-hos-text-secondary rounded-lg hover:bg-hos-bg-tertiary transition-colors font-medium"
                    >
                      Back
                    </button>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentStep('payment')}
                        className="px-6 py-2 border border-hos-border text-hos-text-secondary rounded-lg hover:bg-hos-bg-tertiary transition-colors font-medium"
                      >
                        Skip for now
                      </button>
                      <button
                        onClick={handleVerificationSubmit}
                        disabled={loading || !verification.fileUrl.trim()}
                        className="px-6 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors font-medium disabled:opacity-50"
                      >
                        {loading ? 'Submitting...' : 'Submit & Continue'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 'payment' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">Payment Setup</h2>
                    <p className="text-hos-text-secondary">Connect your payment methods to receive payouts</p>
                  </div>

                  <div className="bg-hos-bg-secondary rounded-lg p-6">
                    <h3 className="font-semibold mb-4">Stripe Integration</h3>
                    <p className="text-sm text-hos-text-secondary mb-4">
                      Connect your Stripe account to receive payments. You can set this up later from your dashboard.
                    </p>
                    <button
                      onClick={() => {
                        // TODO: Implement Stripe connection
                        toast.success('Payment setup can be completed later');
                      }}
                      className="px-6 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors font-medium"
                    >
                      Connect Stripe (Optional)
                    </button>
                  </div>

                  <div className="flex justify-between">
                    <button
                      onClick={() => setCurrentStep(userRole === 'WHOLESALER' ? 'verification' : 'location')}
                      className="px-6 py-2 bg-hos-bg-tertiary text-hos-text-secondary rounded-lg hover:bg-hos-bg-tertiary transition-colors font-medium"
                    >
                      Back
                    </button>
                    <button
                      onClick={handlePaymentSubmit}
                      disabled={loading}
                      className="px-6 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors font-medium disabled:opacity-50"
                    >
                      {loading ? 'Completing...' : 'Complete Setup'}
                    </button>
                  </div>
                </div>
              )}

              {currentStep === 'complete' && (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🎉</div>
                  <h2 className="text-2xl font-bold mb-2">Welcome to HOS Marketplace!</h2>
                  <p className="text-hos-text-secondary mb-6">Your store is set up and ready to go.</p>
                  <p className="text-sm text-hos-text-muted">Redirecting to your dashboard...</p>
                </div>
              )}
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </RouteGuard>
  );
}
