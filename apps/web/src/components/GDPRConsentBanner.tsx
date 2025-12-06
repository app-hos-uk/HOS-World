'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import Link from 'next/link';

interface ConsentPreferences {
  essential: boolean;
  marketing: boolean;
  analytics: boolean;
}

export function GDPRConsentBanner() {
  const toast = useToast();
  const [showBanner, setShowBanner] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [loading, setLoading] = useState(false);
  const [consentPreferences, setConsentPreferences] = useState<ConsentPreferences>({
    essential: true, // Always true
    marketing: false,
    analytics: false,
  });

  useEffect(() => {
    checkConsentStatus();
  }, []);

  const checkConsentStatus = async () => {
    try {
      // Check if consent has been given
      const consentKey = 'gdpr_consent_given';
      const consentGiven = localStorage.getItem(consentKey);
      
      if (!consentGiven) {
        // Check if user is logged in and has consent
        try {
          const response = await apiClient.getGDPRConsent();
          if (response?.data?.gdprConsent) {
            localStorage.setItem(consentKey, 'true');
            return; // Don't show banner if consent already given
          }
        } catch (error) {
          // User not logged in or no consent - show banner
        }
        
        // Show banner if no consent recorded
        setShowBanner(true);
      }
    } catch (error) {
      console.error('Error checking consent status:', error);
    }
  };

  const handleAcceptAll = async () => {
    await handleSaveConsent({
      essential: true,
      marketing: true,
      analytics: true,
    });
  };

  const handleRejectAll = async () => {
    await handleSaveConsent({
      essential: true,
      marketing: false,
      analytics: false,
    });
  };

  const handleSaveConsent = async (preferences: ConsentPreferences) => {
    try {
      setLoading(true);
      
      // Update consent via API
      await apiClient.updateGDPRConsent({
        marketing: preferences.marketing,
        analytics: preferences.analytics,
        essential: preferences.essential,
      });

      // Mark consent as given in localStorage
      localStorage.setItem('gdpr_consent_given', 'true');
      localStorage.setItem('gdpr_consent_preferences', JSON.stringify(preferences));
      
      setShowBanner(false);
      toast.success('Consent preferences saved');
    } catch (error: any) {
      // Even if API fails, save to localStorage for non-authenticated users
      localStorage.setItem('gdpr_consent_given', 'true');
      localStorage.setItem('gdpr_consent_preferences', JSON.stringify(preferences));
      setShowBanner(false);
      
      if (error.message && !error.message.includes('Unauthorized')) {
        toast.error('Failed to save consent preferences');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCustomSave = () => {
    handleSaveConsent(consentPreferences);
  };

  if (!showBanner) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t-2 border-purple-200 shadow-2xl">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {!showDetails ? (
          // Simple Banner View
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
                We value your privacy
              </h3>
              <p className="text-sm text-gray-600 mb-2">
                We use cookies and similar technologies to enhance your experience, analyze site usage, and assist in our marketing efforts. 
                By clicking &quot;Accept All&quot;, you consent to our use of cookies. You can customize your preferences or learn more in our{' '}
                <Link href="/privacy-policy" className="text-purple-600 hover:underline font-medium">
                  Privacy Policy
                </Link>.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
              <button
                onClick={() => setShowDetails(true)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Customize
              </button>
              <button
                onClick={handleRejectAll}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Reject All
              </button>
              <button
                onClick={handleAcceptAll}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Accept All'}
              </button>
            </div>
          </div>
        ) : (
          // Detailed Preferences View
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Cookie & Privacy Preferences
              </h3>
              <p className="text-sm text-gray-600">
                Manage your cookie preferences. You can enable or disable different types of cookies below. 
                Learn more in our{' '}
                <Link href="/privacy-policy" className="text-purple-600 hover:underline font-medium">
                  Privacy Policy
                </Link>.
              </p>
            </div>

            <div className="space-y-3 border-t border-gray-200 pt-4">
              {/* Essential Cookies */}
              <div className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-gray-900">Essential Cookies</h4>
                    <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full font-medium">
                      Required
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    These cookies are necessary for the website to function and cannot be switched off. They are usually only set in response to actions made by you.
                  </p>
                </div>
                <div className="ml-4">
                  <div className="relative inline-flex items-center">
                    <input
                      type="checkbox"
                      checked={true}
                      disabled
                      className="w-11 h-6 bg-purple-600 rounded-full appearance-none cursor-not-allowed opacity-50"
                    />
                  </div>
                </div>
              </div>

              {/* Marketing Cookies */}
              <div className="flex items-start justify-between p-3 bg-white border border-gray-200 rounded-lg">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 mb-1">Marketing Cookies</h4>
                  <p className="text-sm text-gray-600">
                    These cookies are used to deliver personalized advertisements and track campaign performance.
                  </p>
                </div>
                <div className="ml-4">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={consentPreferences.marketing}
                      onChange={(e) =>
                        setConsentPreferences({ ...consentPreferences, marketing: e.target.checked })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>
              </div>

              {/* Analytics Cookies */}
              <div className="flex items-start justify-between p-3 bg-white border border-gray-200 rounded-lg">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 mb-1">Analytics Cookies</h4>
                  <p className="text-sm text-gray-600">
                    These cookies help us understand how visitors interact with our website by collecting and reporting information anonymously.
                  </p>
                </div>
                <div className="ml-4">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={consentPreferences.analytics}
                      onChange={(e) =>
                        setConsentPreferences({ ...consentPreferences, analytics: e.target.checked })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-4 border-t border-gray-200">
              <button
                onClick={() => setShowDetails(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleRejectAll}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Reject All
              </button>
              <button
                onClick={handleCustomSave}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex-1 sm:flex-initial"
              >
                {loading ? 'Saving...' : 'Save Preferences'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

