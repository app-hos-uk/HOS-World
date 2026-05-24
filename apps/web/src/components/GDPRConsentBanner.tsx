'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import Link from 'next/link';
import { dispatchConsentUpdated } from '@/lib/analytics';

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
      const consentKey = 'gdpr_consent_given';
      const consentGiven = localStorage.getItem(consentKey);
      const isLoggedIn = localStorage.getItem('auth_token') || document.cookie.includes('is_logged_in=true');

      if (consentGiven && isLoggedIn) {
        // Consent was given (possibly anonymously). Sync to server if not already synced.
        const syncedKey = 'gdpr_consent_synced';
        if (!localStorage.getItem(syncedKey)) {
          try {
            const prefs = JSON.parse(localStorage.getItem('gdpr_consent_preferences') || '{}');
            await apiClient.updateGDPRConsent({
              marketing: prefs.marketing ?? false,
              analytics: prefs.analytics ?? false,
              essential: prefs.essential ?? true,
            });
            localStorage.setItem(syncedKey, 'true');
          } catch {
            // Best-effort sync; will retry on next page load
          }
        }
        return; // Banner already dismissed
      }

      if (!consentGiven) {
        if (isLoggedIn) {
          try {
            const response = await apiClient.getGDPRConsent();
            if (response?.data?.gdprConsent) {
              localStorage.setItem(consentKey, 'true');
              return;
            }
          } catch {
            // User not logged in / expired token / no consent — show banner
          }
        }
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
      
      const isLoggedIn = localStorage.getItem('auth_token') || document.cookie.includes('is_logged_in=true');
      if (isLoggedIn) {
        try {
          // Update consent via API for authenticated users
          await apiClient.updateGDPRConsent({
            marketing: preferences.marketing,
            analytics: preferences.analytics,
            essential: preferences.essential,
          });
        } catch (apiError: any) {
          // Silently handle API errors (e.g., expired token)
          // Consent will still be saved to localStorage
          console.debug('Privacy consent API call failed, saving locally:', apiError?.message);
        }
      }

      // Always save to localStorage (works for both authenticated and anonymous users)
      localStorage.setItem('gdpr_consent_given', 'true');
      localStorage.setItem('gdpr_consent_preferences', JSON.stringify(preferences));
      dispatchConsentUpdated(preferences);
      
      setShowBanner(false);
      toast.success('Consent preferences saved');
    } catch (error: any) {
      // Fallback: save to localStorage even if something unexpected fails
      localStorage.setItem('gdpr_consent_given', 'true');
      localStorage.setItem('gdpr_consent_preferences', JSON.stringify(preferences));
      dispatchConsentUpdated(preferences);
      setShowBanner(false);
      console.error('Error saving consent:', error);
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
    <div className="fixed bottom-0 w-full bg-hos-bg-secondary border-t border-hos-border p-4 z-50 shadow-lg">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {!showDetails ? (
          // Simple Banner View
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1">
              <h3 className="text-base sm:text-lg font-semibold text-white mb-2">
                We value your privacy
              </h3>
              <p className="text-hos-text-secondary text-sm mb-2">
                We use cookies and similar technologies to enhance your experience, analyze site usage, and assist in our marketing efforts. 
                By clicking &quot;Accept All&quot;, you consent to our use of cookies. You can customize your preferences or learn more in our{' '}
                <Link href="/privacy-policy" className="text-hos-gold hover:text-hos-gold-hover font-medium">
                  Privacy Policy
                </Link>.{' '}
                <Link href="/do-not-sell" className="text-hos-gold hover:text-hos-gold-hover font-medium">
                  Do Not Sell or Share My Personal Information
                </Link>.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
              <button
                onClick={() => setShowDetails(true)}
                className="border border-hos-border text-hos-text-secondary px-5 py-2 rounded-md text-sm hover:border-hos-gold hover:text-hos-gold transition-colors"
              >
                Customize
              </button>
              <button
                onClick={handleRejectAll}
                disabled={loading}
                className="border border-hos-border text-hos-text-secondary px-5 py-2 rounded-md text-sm hover:border-hos-gold hover:text-hos-gold transition-colors disabled:opacity-50"
              >
                Reject All
              </button>
              <button
                onClick={handleAcceptAll}
                disabled={loading}
                className="bg-hos-gold text-[#1a1406] px-5 py-2 rounded-md font-semibold text-sm hover:bg-hos-gold-hover transition-colors disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Accept All'}
              </button>
            </div>
          </div>
        ) : (
          // Detailed Preferences View
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Cookie & Privacy Preferences
              </h3>
              <p className="text-hos-text-secondary text-sm">
                Manage your cookie preferences. You can enable or disable different types of cookies below. 
                Learn more in our{' '}
                <Link href="/privacy-policy" className="text-hos-gold hover:text-hos-gold-hover font-medium">
                  Privacy Policy
                </Link>.
              </p>
            </div>

            <div className="space-y-3 border-t border-hos-border pt-4">
              {/* Essential Cookies */}
              <div className="flex items-start justify-between p-3 bg-hos-bg rounded-lg border border-hos-border">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-white">Essential Cookies</h4>
                    <span className="px-2 py-0.5 bg-hos-new-green/20 text-hos-new-green text-xs rounded-full font-medium">
                      Required
                    </span>
                  </div>
                  <p className="text-hos-text-secondary text-sm">
                    These cookies are necessary for the website to function and cannot be switched off. They are usually only set in response to actions made by you.
                  </p>
                </div>
                <div className="ml-4">
                  <div className="relative inline-flex items-center">
                    <input
                      type="checkbox"
                      checked={true}
                      disabled
                      className="w-11 h-6 bg-hos-gold rounded-full appearance-none cursor-not-allowed opacity-50"
                    />
                  </div>
                </div>
              </div>

              {/* Marketing Cookies */}
              <div className="flex items-start justify-between p-3 bg-hos-bg border border-hos-border rounded-lg">
                <div className="flex-1">
                  <h4 className="font-medium text-white mb-1">Marketing Cookies</h4>
                  <p className="text-hos-text-secondary text-sm">
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
                    <div className="w-11 h-6 bg-hos-bg-tertiary peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-hos-gold/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-hos-bg-secondary after:border-hos-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-hos-gold"></div>
                  </label>
                </div>
              </div>

              {/* Analytics Cookies */}
              <div className="flex items-start justify-between p-3 bg-hos-bg border border-hos-border rounded-lg">
                <div className="flex-1">
                  <h4 className="font-medium text-white mb-1">Analytics Cookies</h4>
                  <p className="text-hos-text-secondary text-sm">
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
                    <div className="w-11 h-6 bg-hos-bg-tertiary peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-hos-gold/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-hos-bg-secondary after:border-hos-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-hos-gold"></div>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-4 border-t border-hos-border">
              <button
                onClick={() => setShowDetails(false)}
                className="border border-hos-border text-hos-text-secondary px-5 py-2 rounded-md text-sm hover:border-hos-gold hover:text-hos-gold transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleRejectAll}
                disabled={loading}
                className="border border-hos-border text-hos-text-secondary px-5 py-2 rounded-md text-sm hover:border-hos-gold hover:text-hos-gold transition-colors disabled:opacity-50"
              >
                Reject All
              </button>
              <button
                onClick={handleCustomSave}
                disabled={loading}
                className="bg-hos-gold text-[#1a1406] px-5 py-2 rounded-md font-semibold text-sm hover:bg-hos-gold-hover transition-colors disabled:opacity-50 flex-1 sm:flex-initial"
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

