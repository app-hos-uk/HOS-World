'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { EmailTestPanel } from '@/components/admin/EmailTestPanel';

const defaultSettings = {
  // General Settings
  platformName: 'House of Spells Marketplace',
  platformUrl: 'https://hos-marketplace.com',
  maintenanceMode: false,
  allowRegistration: true,
  requireEmailVerification: false,
  shopEnabled: false,
  
  // Social Media URLs
  socialFacebookUrl: '',
  socialInstagramUrl: '',
  socialXUrl: '',

  // Storefront contact (footer, structured data)
  contactEmail: 'info@houseofspells.com',
  contactPhone: '+1 (212) 555-0199',
  contactAddress: '1564 Broadway, Times Square, New York, NY 10036',
  footerAbout:
    'An immersive fandom experience — franchises, collectibles, and unforgettable finds online and in our stores.',
  
  // Email Settings
  smtpHost: '',
  smtpPort: 587,
  smtpUser: '',
  smtpFrom: 'noreply@houseofspells.com',
  emailNotifications: true,
  
  // Payment Settings
  stripeEnabled: false,
  stripeTestMode: true,
  defaultCurrency: 'USD',
  platformFee: 15.0,
  cancellationAutoApprovalWindowMinutes: 30,
  
  // Fulfillment Settings
  autoCreateShipments: false,
  defaultFulfillmentCenter: '',
  requireTrackingNumber: true,
  
  // Notification Settings
  notifyOnNewSubmission: true,
  notifyOnNewOrder: true,
  notifyOnShipmentReceived: true,
};

export default function AdminSettingsPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'general' | 'email' | 'payment' | 'fulfillment' | 'notifications'>('general');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  
  const [settings, setSettings] = useState(defaultSettings);

  // Fetch existing settings on mount
  useEffect(() => {
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getSystemSettings();
      if (response?.data) {
        const d = response.data;
        setSettings({
          ...defaultSettings,
          ...d,
          defaultCurrency: d.defaultCurrency || d.currency || defaultSettings.defaultCurrency,
          platformFee: d.platformFee ?? (d.platformFeeRate != null ? d.platformFeeRate * 100 : defaultSettings.platformFee),
        });
      }
    } catch (err: any) {
      console.error('Error fetching settings:', err);
      // Keep default settings if fetch fails
      toast.error('Failed to load settings. Using defaults.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = {
        ...settings,
        currency: settings.defaultCurrency,
        platformFeeRate: settings.platformFee / 100,
      };
      await apiClient.updateSystemSettings(payload);
      toast.success('Settings saved successfully!');
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast.error(error.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: string, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const tabs = [
    { id: 'general', label: 'General', icon: '⚙️' },
    { id: 'email', label: 'Email', icon: '📧' },
    { id: 'payment', label: 'Payment', icon: '💳' },
    { id: 'fulfillment', label: 'Fulfillment', icon: '🚚' },
    { id: 'notifications', label: 'Notifications', icon: '🔔' },
  ];

  return (
    <RouteGuard allowedRoles={['ADMIN']} showAccessDenied={true}>
              <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">System Settings</h1>
          <p className="text-hos-text-secondary mt-2">Configure platform-wide settings and preferences</p>
        </div>

        {/* Quick Access Cards */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Link
            href="/admin/settings/integrations"
            className="group bg-gradient-to-br from-hos-bg to-hos-bg-tertiary border border-hos-border-accent rounded-lg p-5 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">🔌</span>
              <h3 className="font-semibold text-hos-text-secondary group-hover:text-hos-gold-hover">Integrations</h3>
            </div>
            <p className="text-sm text-hos-text-secondary">
              Configure third-party services: shipping carriers, tax services, payment gateways
            </p>
            <span className="inline-flex items-center mt-3 text-sm text-hos-gold font-medium group-hover:gap-2 transition-all">
              Manage Integrations
              <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </Link>

          <Link
            href="/admin/settings/integrations/shipping"
            className="group bg-gradient-to-br from-hos-bg-secondary to-hos-bg-tertiary border border-hos-border-accent rounded-lg p-5 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">🚚</span>
              <h3 className="font-semibold text-hos-text-secondary group-hover:text-hos-gold-hover">Shipping Carriers</h3>
            </div>
            <p className="text-sm text-hos-text-secondary">
              USPS, FedEx, DHL - Generate labels and track shipments
            </p>
            <span className="inline-flex items-center mt-3 text-sm text-hos-gold font-medium group-hover:gap-2 transition-all">
              Configure Carriers
              <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </Link>

          <Link
            href="/admin/settings/integrations/tax"
            className="group bg-gradient-to-br from-green-50 to-green-100 border border-green-500/30 rounded-lg p-5 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">📊</span>
              <h3 className="font-semibold text-hos-text-secondary group-hover:text-green-400">Tax Services</h3>
            </div>
            <p className="text-sm text-hos-text-secondary">
              Avalara, TaxJar - Automated tax calculation and compliance
            </p>
            <span className="inline-flex items-center mt-3 text-sm text-green-400 font-medium group-hover:gap-2 transition-all">
              Configure Tax
              <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-hos-gold mx-auto mb-4"></div>
              <p className="text-hos-text-secondary">Loading settings...</p>
            </div>
          </div>
        ) : (
        <div className="bg-hos-bg-secondary border border-hos-border rounded-lg">
          {/* Tabs */}
          <div className="border-b border-hos-border">
            <div className="flex overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-6 py-4 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-hos-gold text-hos-gold'
                      : 'border-transparent text-hos-text-muted hover:text-hos-text-secondary hover:border-hos-border'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'general' && (
              <div className="space-y-6">
                {/* ── E-Commerce Toggle ── */}
                <div className="rounded-lg border border-hos-border p-5 bg-gradient-to-r from-hos-bg to-hos-bg-tertiary">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        Online Shop
                        <span
                          className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${
                            settings.shopEnabled
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}
                        >
                          {settings.shopEnabled ? 'LIVE' : 'OFF'}
                        </span>
                      </h3>
                      <p className="text-sm text-hos-text-muted mt-1">
                        {settings.shopEnabled
                          ? 'The storefront is live. Customers can browse products, add to cart, and checkout.'
                          : 'All e-commerce routes redirect to a "Coming Soon" page. Toggle on when ready to launch.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={settings.shopEnabled}
                      onClick={() => updateSetting('shopEnabled', !settings.shopEnabled)}
                      className={`relative inline-flex h-8 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-hos-gold/50 ${
                        settings.shopEnabled ? 'bg-green-500' : 'bg-hos-bg-tertiary'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          settings.shopEnabled ? 'translate-x-6' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4">General Settings</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                        Platform Name
                      </label>
                      <input
                        type="text"
                        value={settings.platformName}
                        onChange={(e) => updateSetting('platformName', e.target.value)}
                        className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                        Platform URL
                      </label>
                      <input
                        type="url"
                        value={settings.platformUrl}
                        onChange={(e) => updateSetting('platformUrl', e.target.value)}
                        className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="maintenanceMode"
                        checked={settings.maintenanceMode}
                        onChange={(e) => updateSetting('maintenanceMode', e.target.checked)}
                        className="h-4 w-4 text-hos-gold focus:ring-hos-gold/50"
                      />
                      <label htmlFor="maintenanceMode" className="text-sm font-medium text-hos-text-secondary">
                        Maintenance Mode
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="allowRegistration"
                        checked={settings.allowRegistration}
                        onChange={(e) => updateSetting('allowRegistration', e.target.checked)}
                        className="h-4 w-4 text-hos-gold focus:ring-hos-gold/50"
                      />
                      <label htmlFor="allowRegistration" className="text-sm font-medium text-hos-text-secondary">
                        Allow User Registration
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="requireEmailVerification"
                        checked={settings.requireEmailVerification}
                        onChange={(e) => updateSetting('requireEmailVerification', e.target.checked)}
                        className="h-4 w-4 text-hos-gold focus:ring-hos-gold/50"
                      />
                      <label htmlFor="requireEmailVerification" className="text-sm font-medium text-hos-text-secondary">
                        Require Email Verification
                      </label>
                    </div>
                  </div>
                </div>

                {/* Social Media URLs */}
                <div>
                  <h3 className="text-lg font-semibold mb-1">Social Media URLs</h3>
                  <p className="text-sm text-hos-text-muted mb-4">
                    These links appear in the footer social icons. Leave blank to use the default House of Spells profiles.
                  </p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                        Facebook URL
                      </label>
                      <input
                        type="url"
                        value={settings.socialFacebookUrl}
                        onChange={(e) => updateSetting('socialFacebookUrl', e.target.value)}
                        placeholder="https://www.facebook.com/houseofspellsuk"
                        className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                        Instagram URL
                      </label>
                      <input
                        type="url"
                        value={settings.socialInstagramUrl}
                        onChange={(e) => updateSetting('socialInstagramUrl', e.target.value)}
                        placeholder="https://www.instagram.com/houseofspells"
                        className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                        X (Twitter) URL
                      </label>
                      <input
                        type="url"
                        value={settings.socialXUrl}
                        onChange={(e) => updateSetting('socialXUrl', e.target.value)}
                        placeholder="https://x.com/houseofspells"
                        className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
                      />
                    </div>
                  </div>
                </div>

                {/* Storefront contact */}
                <div>
                  <h3 className="text-lg font-semibold mb-1">Storefront Contact</h3>
                  <p className="text-sm text-hos-text-muted mb-4">
                    Shown in the site footer and contact blocks. Update here instead of redeploying for address or phone changes.
                  </p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">Contact email</label>
                      <input
                        type="email"
                        value={settings.contactEmail}
                        onChange={(e) => updateSetting('contactEmail', e.target.value)}
                        className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">Phone</label>
                      <input
                        type="text"
                        value={settings.contactPhone}
                        onChange={(e) => updateSetting('contactPhone', e.target.value)}
                        className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">Address</label>
                      <input
                        type="text"
                        value={settings.contactAddress}
                        onChange={(e) => updateSetting('contactAddress', e.target.value)}
                        className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">Footer about text</label>
                      <textarea
                        rows={3}
                        value={settings.footerAbout}
                        onChange={(e) => updateSetting('footerAbout', e.target.value)}
                        className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'email' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Email Configuration</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">SMTP Host</label>
                      <input
                        type="text"
                        value={settings.smtpHost}
                        onChange={(e) => updateSetting('smtpHost', e.target.value)}
                        placeholder="smtp.gmail.com"
                        className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-hos-text-secondary mb-1">SMTP Port</label>
                        <input
                          type="number"
                          value={settings.smtpPort}
                          onChange={(e) => updateSetting('smtpPort', parseInt(e.target.value))}
                          className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-hos-text-secondary mb-1">SMTP User</label>
                        <input
                          type="text"
                          value={settings.smtpUser}
                          onChange={(e) => updateSetting('smtpUser', e.target.value)}
                          className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">From Email</label>
                      <input
                        type="email"
                        value={settings.smtpFrom}
                        onChange={(e) => updateSetting('smtpFrom', e.target.value)}
                        className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="emailNotifications"
                        checked={settings.emailNotifications}
                        onChange={(e) => updateSetting('emailNotifications', e.target.checked)}
                        className="h-4 w-4 text-hos-gold focus:ring-hos-gold/50"
                      />
                      <label htmlFor="emailNotifications" className="text-sm font-medium text-hos-text-secondary">
                        Enable Email Notifications
                      </label>
                    </div>
                    <p className="text-xs text-hos-text-muted">
                      For production, configure SendGrid under{' '}
                      <Link href="/admin/settings/integrations" className="text-hos-gold hover:text-hos-gold-hover">
                        Settings → Integrations → Email Services
                      </Link>
                      . SMTP fields here are not persisted to the server yet.
                    </p>
                  </div>
                </div>
                <EmailTestPanel showIntegrationsLink />
              </div>
            )}

            {activeTab === 'payment' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Payment Settings</h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="stripeEnabled"
                        checked={settings.stripeEnabled}
                        onChange={(e) => updateSetting('stripeEnabled', e.target.checked)}
                        className="h-4 w-4 text-hos-gold focus:ring-hos-gold/50"
                      />
                      <label htmlFor="stripeEnabled" className="text-sm font-medium text-hos-text-secondary">
                        Enable Stripe Payments
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="stripeTestMode"
                        checked={settings.stripeTestMode}
                        onChange={(e) => updateSetting('stripeTestMode', e.target.checked)}
                        className="h-4 w-4 text-hos-gold focus:ring-hos-gold/50"
                      />
                      <label htmlFor="stripeTestMode" className="text-sm font-medium text-hos-text-secondary">
                        Stripe Test Mode
                      </label>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                        Default Currency
                      </label>
                      <select
                        value={settings.defaultCurrency}
                        onChange={(e) => updateSetting('defaultCurrency', e.target.value)}
                        className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
                      >
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="AED">AED</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                        Platform Fee (%)
                      </label>
                      <input
                        type="number"
                        value={settings.platformFee}
                        onChange={(e) => updateSetting('platformFee', parseFloat(e.target.value))}
                        step="0.1"
                        min="0"
                        max="100"
                        className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                        Cancellation Auto-Approval Window (minutes)
                      </label>
                      <input
                        type="number"
                        value={settings.cancellationAutoApprovalWindowMinutes}
                        onChange={(e) =>
                          updateSetting(
                            'cancellationAutoApprovalWindowMinutes',
                            parseInt(e.target.value, 10) || 0,
                          )
                        }
                        min="0"
                        max="1440"
                        className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
                      />
                      <p className="text-xs text-hos-text-muted mt-1">
                        Paid orders cancelled within this window are auto-approved without seller/finance review. Set to 0 to disable.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'fulfillment' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Fulfillment Settings</h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="autoCreateShipments"
                        checked={settings.autoCreateShipments}
                        onChange={(e) => updateSetting('autoCreateShipments', e.target.checked)}
                        className="h-4 w-4 text-hos-gold focus:ring-hos-gold/50"
                      />
                      <label htmlFor="autoCreateShipments" className="text-sm font-medium text-hos-text-secondary">
                        Auto-create Shipments on Approval
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="requireTrackingNumber"
                        checked={settings.requireTrackingNumber}
                        onChange={(e) => updateSetting('requireTrackingNumber', e.target.checked)}
                        className="h-4 w-4 text-hos-gold focus:ring-hos-gold/50"
                      />
                      <label htmlFor="requireTrackingNumber" className="text-sm font-medium text-hos-text-secondary">
                        Require Tracking Number
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Notification Preferences</h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="notifyOnNewSubmission"
                        checked={settings.notifyOnNewSubmission}
                        onChange={(e) => updateSetting('notifyOnNewSubmission', e.target.checked)}
                        className="h-4 w-4 text-hos-gold focus:ring-hos-gold/50"
                      />
                      <label htmlFor="notifyOnNewSubmission" className="text-sm font-medium text-hos-text-secondary">
                        Notify on New Product Submission
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="notifyOnNewOrder"
                        checked={settings.notifyOnNewOrder}
                        onChange={(e) => updateSetting('notifyOnNewOrder', e.target.checked)}
                        className="h-4 w-4 text-hos-gold focus:ring-hos-gold/50"
                      />
                      <label htmlFor="notifyOnNewOrder" className="text-sm font-medium text-hos-text-secondary">
                        Notify on New Order
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="notifyOnShipmentReceived"
                        checked={settings.notifyOnShipmentReceived}
                        onChange={(e) => updateSetting('notifyOnShipmentReceived', e.target.checked)}
                        className="h-4 w-4 text-hos-gold focus:ring-hos-gold/50"
                      />
                      <label htmlFor="notifyOnShipmentReceived" className="text-sm font-medium text-hos-text-secondary">
                        Notify on Shipment Received
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Save Button */}
            <div className="mt-6 pt-6 border-t border-hos-border">
              <button
                onClick={() => setShowConfirm(true)}
                disabled={saving}
                className="px-6 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors font-medium disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>

            {/* Confirmation Dialog */}
            {showConfirm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                <div className="bg-hos-bg-secondary rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
                  <h3 className="text-lg font-semibold mb-2">Confirm Changes</h3>
                  <p className="text-hos-text-secondary text-sm mb-6">
                    Are you sure you want to save these settings? This will apply changes platform-wide.
                  </p>
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setShowConfirm(false)}
                      className="px-4 py-2 text-hos-text-secondary bg-hos-bg-tertiary rounded-lg hover:bg-hos-bg-tertiary transition-colors font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => { setShowConfirm(false); handleSave(); }}
                      disabled={saving}
                      className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors font-medium disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Confirm & Save'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        )}
          </RouteGuard>
  );
}
