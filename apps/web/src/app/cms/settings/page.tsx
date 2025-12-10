'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { CMSLayout } from '@/components/CMSLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function CMSSettingsPage() {
  const toast = useToast();
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getCMSSettings();
      if (response?.data) {
        setSettings(response.data);
      }
    } catch (err: any) {
      console.error('Error fetching settings:', err);
      setError(err.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      const response = await apiClient.updateCMSSettings(settings);
      if (response?.data) {
        toast.success('Settings saved successfully');
        setSettings(response.data);
      }
    } catch (err: any) {
      console.error('Error saving settings:', err);
      setError(err.message || 'Failed to save settings');
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (key: string, value: any) => {
    setSettings((prev: any) => ({
      ...prev,
      [key]: value,
    }));
  };

  return (
    <RouteGuard allowedRoles={['CMS_EDITOR', 'ADMIN']}>
      <CMSLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">CMS Settings</h1>
              <p className="text-gray-600 mt-1">Configure your CMS preferences</p>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">Error: {error}</p>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-500">Loading settings...</div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Site Name
                </label>
                <input
                  type="text"
                  value={settings.siteName || ''}
                  onChange={(e) => handleChange('siteName', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="Enter site name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Site Description
                </label>
                <textarea
                  value={settings.siteDescription || ''}
                  onChange={(e) => handleChange('siteDescription', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  rows={3}
                  placeholder="Enter site description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Language
                </label>
                <select
                  value={settings.defaultLanguage || 'en'}
                  onChange={(e) => handleChange('defaultLanguage', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                </select>
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.autoPublish || false}
                    onChange={(e) => handleChange('autoPublish', e.target.checked)}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Auto-publish new content
                  </span>
                </label>
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.enableComments || false}
                    onChange={(e) => handleChange('enableComments', e.target.checked)}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Enable comments on blog posts
                  </span>
                </label>
              </div>
            </div>
          )}
        </div>
      </CMSLayout>
    </RouteGuard>
  );
}

