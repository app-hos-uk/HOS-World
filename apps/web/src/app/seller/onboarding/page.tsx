'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

type OnboardingStep = 'store-info' | 'location' | 'theme' | 'payment' | 'complete';

export default function SellerOnboardingPage() {
  const router = useRouter();
  const toast = useToast();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('store-info');
  const [loading, setLoading] = useState(false);
  const [sellerProfile, setSellerProfile] = useState<any>(null);

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

  const [theme, setTheme] = useState({
    themeId: '',
  });

  const [payment, setPayment] = useState({
    stripeConnected: false,
  });

  useEffect(() => {
    checkExistingProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkExistingProfile = async () => {
    try {
      const response = await apiClient.getSellerProfile();
      if (response?.data) {
        const seller = response.data;
        setSellerProfile(seller);

        // If profile is complete, redirect to dashboard
        if (seller.storeName && seller.country && seller.verified !== false) {
          router.push('/seller/dashboard');
          return;
        }

        // Pre-fill form with existing data
        if (seller.storeName) {
          setStoreInfo({
            storeName: seller.storeName,
            description: seller.description || '',
            logo: seller.logo || '',
          });
          setCurrentStep('location');
        }

        if (seller.country) {
          setLocation({
            country: seller.country,
            city: seller.city || '',
            region: seller.region || '',
            timezone: seller.timezone || 'UTC',
          });
          setCurrentStep('theme');
        }

        if (seller.themeId) {
          setTheme({ themeId: seller.themeId });
          setCurrentStep('payment');
        }
      }
    } catch (err: any) {
      // Profile doesn't exist yet, start from beginning
      console.log('No existing profile, starting onboarding');
    }
  };

  const handleStoreInfoSubmit = async () => {
    if (!storeInfo.storeName) {
      toast.error('Store name is required');
      return;
    }

    try {
      setLoading(true);
      await apiClient.updateSellerProfile({
        storeName: storeInfo.storeName,
        description: storeInfo.description,
        logo: storeInfo.logo,
      });
      toast.success('Store information saved');
      setCurrentStep('location');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save store information');
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
      setCurrentStep('theme');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save location');
    } finally {
      setLoading(false);
    }
  };

  const handleThemeSubmit = async () => {
    if (!theme.themeId) {
      toast.error('Please select a theme');
      return;
    }

    try {
      setLoading(true);
      await apiClient.updateSellerTheme({ themeId: theme.themeId });
      toast.success('Theme selected');
      setCurrentStep('payment');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save theme');
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

  const steps: { key: OnboardingStep; title: string; description: string }[] = [
    { key: 'store-info', title: 'Store Information', description: 'Set up your store details' },
    { key: 'location', title: 'Location', description: 'Add your business location' },
    { key: 'theme', title: 'Theme', description: 'Choose your store theme' },
    { key: 'payment', title: 'Payment Setup', description: 'Connect payment methods' },
    { key: 'complete', title: 'Complete', description: 'You\'re all set!' },
  ];

  const currentStepIndex = steps.findIndex((s) => s.key === currentStep);

  return (
    <RouteGuard allowedRoles={['SELLER', 'B2C_SELLER', 'WHOLESALER', 'ADMIN']} showAccessDenied={true}>
      <div className="min-h-screen bg-white">
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
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {index < currentStepIndex ? '✓' : index + 1}
                      </div>
                      <div className="mt-2 text-center hidden sm:block">
                        <div
                          className={`text-xs font-medium ${
                            index <= currentStepIndex ? 'text-purple-600' : 'text-gray-500'
                          }`}
                        >
                          {step.title}
                        </div>
                      </div>
                    </div>
                    {index < steps.length - 1 && (
                      <div
                        className={`h-1 flex-1 mx-2 transition-colors ${
                          index < currentStepIndex ? 'bg-purple-600' : 'bg-gray-200'
                        }`}
                      ></div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Step Content */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 sm:p-8">
              {currentStep === 'store-info' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">Store Information</h2>
                    <p className="text-gray-600">Let&apos;s start by setting up your store details</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Store Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={storeInfo.storeName}
                      onChange={(e) => setStoreInfo({ ...storeInfo, storeName: e.target.value })}
                      placeholder="My Awesome Store"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Store Description</label>
                    <textarea
                      value={storeInfo.description}
                      onChange={(e) => setStoreInfo({ ...storeInfo, description: e.target.value })}
                      placeholder="Tell customers about your store..."
                      rows={4}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Store Logo URL</label>
                    <input
                      type="url"
                      value={storeInfo.logo}
                      onChange={(e) => setStoreInfo({ ...storeInfo, logo: e.target.value })}
                      placeholder="https://example.com/logo.png"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">You can upload a logo later</p>
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={handleStoreInfoSubmit}
                      disabled={loading || !storeInfo.storeName}
                      className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50"
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
                    <p className="text-gray-600">Where is your business located?</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Country <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={location.country}
                      onChange={(e) => setLocation({ ...location, country: e.target.value })}
                      placeholder="United Kingdom"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                      <input
                        type="text"
                        value={location.city}
                        onChange={(e) => setLocation({ ...location, city: e.target.value })}
                        placeholder="London"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Region/State</label>
                      <input
                        type="text"
                        value={location.region}
                        onChange={(e) => setLocation({ ...location, region: e.target.value })}
                        placeholder="England"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between">
                    <button
                      onClick={() => setCurrentStep('store-info')}
                      className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleLocationSubmit}
                      disabled={loading || !location.country}
                      className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50"
                    >
                      {loading ? 'Saving...' : 'Continue'}
                    </button>
                  </div>
                </div>
              )}

              {currentStep === 'theme' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">Choose Your Theme</h2>
                    <p className="text-gray-600">Select a theme for your store</p>
                  </div>

                  <ThemeSelector
                    selectedThemeId={theme.themeId}
                    onSelect={(themeId) => setTheme({ themeId })}
                  />

                  <div className="flex justify-between">
                    <button
                      onClick={() => setCurrentStep('location')}
                      className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleThemeSubmit}
                      disabled={loading || !theme.themeId}
                      className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50"
                    >
                      {loading ? 'Saving...' : 'Continue'}
                    </button>
                  </div>
                </div>
              )}

              {currentStep === 'payment' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">Payment Setup</h2>
                    <p className="text-gray-600">Connect your payment methods to receive payouts</p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="font-semibold mb-4">Stripe Integration</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Connect your Stripe account to receive payments. You can set this up later from your dashboard.
                    </p>
                    <button
                      onClick={() => {
                        // TODO: Implement Stripe connection
                        toast.success('Payment setup can be completed later');
                      }}
                      className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                    >
                      Connect Stripe (Optional)
                    </button>
                  </div>

                  <div className="flex justify-between">
                    <button
                      onClick={() => setCurrentStep('theme')}
                      className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                    >
                      Back
                    </button>
                    <button
                      onClick={handlePaymentSubmit}
                      disabled={loading}
                      className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50"
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
                  <p className="text-gray-600 mb-6">Your store is set up and ready to go.</p>
                  <p className="text-sm text-gray-500">Redirecting to your dashboard...</p>
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

// Theme Selector Component
function ThemeSelector({
  selectedThemeId,
  onSelect,
}: {
  selectedThemeId: string;
  onSelect: (themeId: string) => void;
}) {
  const [themes, setThemes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchThemes();
  }, []);

  const fetchThemes = async () => {
    try {
      const response = await apiClient.getThemes('SELLER');
      if (response?.data) {
        setThemes(response.data.filter((t: any) => t.isActive));
      }
    } catch (err) {
      console.error('Error fetching themes:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading themes...</div>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {themes.map((theme) => (
        <button
          key={theme.id}
          onClick={() => onSelect(theme.id)}
          className={`p-4 border-2 rounded-lg text-left transition-all ${
            selectedThemeId === theme.id
              ? 'border-purple-600 bg-purple-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="aspect-video bg-gray-100 rounded mb-3 flex items-center justify-center">
            {theme.previewImages && theme.previewImages.length > 0 ? (
              <img
                src={theme.previewImages[0]}
                alt={theme.name}
                className="w-full h-full object-cover rounded"
              />
            ) : (
              <span className="text-4xl">🎨</span>
            )}
          </div>
          <div className="font-semibold">{theme.name}</div>
          {theme.description && (
            <div className="text-sm text-gray-600 mt-1 line-clamp-2">{theme.description}</div>
          )}
        </button>
      ))}
    </div>
  );
}

