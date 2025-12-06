'use client';

import { useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<'general' | 'email' | 'payment' | 'fulfillment' | 'notifications'>('general');
  const [saving, setSaving] = useState(false);
  
  const [settings, setSettings] = useState({
    // General Settings
    platformName: 'House of Spells Marketplace',
    platformUrl: 'https://hos-marketplace.com',
    maintenanceMode: false,
    allowRegistration: true,
    requireEmailVerification: false,
    
    // Email Settings
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    smtpFrom: 'noreply@hos-marketplace.com',
    emailNotifications: true,
    
    // Payment Settings
    stripeEnabled: false,
    stripeTestMode: true,
    defaultCurrency: 'USD',
    platformFee: 5.0,
    
    // Fulfillment Settings
    autoCreateShipments: false,
    defaultFulfillmentCenter: '',
    requireTrackingNumber: true,
    
    // Notification Settings
    notifyOnNewSubmission: true,
    notifyOnNewOrder: true,
    notifyOnShipmentReceived: true,
  });

  const handleSave = async () => {
    try {
      setSaving(true);
      await apiClient.updateSystemSettings(settings);
      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings');
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
      <AdminLayout>
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">System Settings</h1>
          <p className="text-gray-600 mt-2">Configure platform-wide settings and preferences</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg">
          {/* Tabs */}
          <div className="border-b border-gray-200">
            <div className="flex overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-6 py-4 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-purple-600 text-purple-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
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
                <div>
                  <h3 className="text-lg font-semibold mb-4">General Settings</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Platform Name
                      </label>
                      <input
                        type="text"
                        value={settings.platformName}
                        onChange={(e) => updateSetting('platformName', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Platform URL
                      </label>
                      <input
                        type="url"
                        value={settings.platformUrl}
                        onChange={(e) => updateSetting('platformUrl', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="maintenanceMode"
                        checked={settings.maintenanceMode}
                        onChange={(e) => updateSetting('maintenanceMode', e.target.checked)}
                        className="h-4 w-4 text-purple-600 focus:ring-purple-500"
                      />
                      <label htmlFor="maintenanceMode" className="text-sm font-medium text-gray-700">
                        Maintenance Mode
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="allowRegistration"
                        checked={settings.allowRegistration}
                        onChange={(e) => updateSetting('allowRegistration', e.target.checked)}
                        className="h-4 w-4 text-purple-600 focus:ring-purple-500"
                      />
                      <label htmlFor="allowRegistration" className="text-sm font-medium text-gray-700">
                        Allow User Registration
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="requireEmailVerification"
                        checked={settings.requireEmailVerification}
                        onChange={(e) => updateSetting('requireEmailVerification', e.target.checked)}
                        className="h-4 w-4 text-purple-600 focus:ring-purple-500"
                      />
                      <label htmlFor="requireEmailVerification" className="text-sm font-medium text-gray-700">
                        Require Email Verification
                      </label>
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Host</label>
                      <input
                        type="text"
                        value={settings.smtpHost}
                        onChange={(e) => updateSetting('smtpHost', e.target.value)}
                        placeholder="smtp.gmail.com"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Port</label>
                        <input
                          type="number"
                          value={settings.smtpPort}
                          onChange={(e) => updateSetting('smtpPort', parseInt(e.target.value))}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">SMTP User</label>
                        <input
                          type="text"
                          value={settings.smtpUser}
                          onChange={(e) => updateSetting('smtpUser', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">From Email</label>
                      <input
                        type="email"
                        value={settings.smtpFrom}
                        onChange={(e) => updateSetting('smtpFrom', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="emailNotifications"
                        checked={settings.emailNotifications}
                        onChange={(e) => updateSetting('emailNotifications', e.target.checked)}
                        className="h-4 w-4 text-purple-600 focus:ring-purple-500"
                      />
                      <label htmlFor="emailNotifications" className="text-sm font-medium text-gray-700">
                        Enable Email Notifications
                      </label>
                    </div>
                  </div>
                </div>
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
                        className="h-4 w-4 text-purple-600 focus:ring-purple-500"
                      />
                      <label htmlFor="stripeEnabled" className="text-sm font-medium text-gray-700">
                        Enable Stripe Payments
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="stripeTestMode"
                        checked={settings.stripeTestMode}
                        onChange={(e) => updateSetting('stripeTestMode', e.target.checked)}
                        className="h-4 w-4 text-purple-600 focus:ring-purple-500"
                      />
                      <label htmlFor="stripeTestMode" className="text-sm font-medium text-gray-700">
                        Stripe Test Mode
                      </label>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Default Currency
                      </label>
                      <select
                        value={settings.defaultCurrency}
                        onChange={(e) => updateSetting('defaultCurrency', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="USD">USD</option>
                        <option value="GBP">GBP</option>
                        <option value="EUR">EUR</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Platform Fee (%)
                      </label>
                      <input
                        type="number"
                        value={settings.platformFee}
                        onChange={(e) => updateSetting('platformFee', parseFloat(e.target.value))}
                        step="0.1"
                        min="0"
                        max="100"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      />
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
                        className="h-4 w-4 text-purple-600 focus:ring-purple-500"
                      />
                      <label htmlFor="autoCreateShipments" className="text-sm font-medium text-gray-700">
                        Auto-create Shipments on Approval
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="requireTrackingNumber"
                        checked={settings.requireTrackingNumber}
                        onChange={(e) => updateSetting('requireTrackingNumber', e.target.checked)}
                        className="h-4 w-4 text-purple-600 focus:ring-purple-500"
                      />
                      <label htmlFor="requireTrackingNumber" className="text-sm font-medium text-gray-700">
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
                        className="h-4 w-4 text-purple-600 focus:ring-purple-500"
                      />
                      <label htmlFor="notifyOnNewSubmission" className="text-sm font-medium text-gray-700">
                        Notify on New Product Submission
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="notifyOnNewOrder"
                        checked={settings.notifyOnNewOrder}
                        onChange={(e) => updateSetting('notifyOnNewOrder', e.target.checked)}
                        className="h-4 w-4 text-purple-600 focus:ring-purple-500"
                      />
                      <label htmlFor="notifyOnNewOrder" className="text-sm font-medium text-gray-700">
                        Notify on New Order
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="notifyOnShipmentReceived"
                        checked={settings.notifyOnShipmentReceived}
                        onChange={(e) => updateSetting('notifyOnShipmentReceived', e.target.checked)}
                        className="h-4 w-4 text-purple-600 focus:ring-purple-500"
                      />
                      <label htmlFor="notifyOnShipmentReceived" className="text-sm font-medium text-gray-700">
                        Notify on Shipment Received
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Save Button */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
