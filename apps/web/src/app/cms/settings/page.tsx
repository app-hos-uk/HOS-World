'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { CMSLayout } from '@/components/CMSLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { CmsPortalErrorBanner } from '@/components/CmsPortalErrorBanner';
import { cmsActionToastMessage, cmsLoadingErrorMessage } from '@/lib/cmsPortalFeedback';

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
    } catch (err: unknown) {
      console.error('Error fetching settings:', err);
      setError(cmsLoadingErrorMessage(err));
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
    } catch (err: unknown) {
      console.error('Error saving settings:', err);
      const msg = cmsActionToastMessage(err, 'Failed to save settings');
      setError(msg);
      toast.error(msg);
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
              <h1 className="text-2xl font-bold text-white">CMS Settings</h1>
              <p className="text-hos-text-secondary mt-1">Configure your CMS preferences</p>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-3 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors font-medium disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>

          <CmsPortalErrorBanner message={error} showSettingsLink={false} />

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-hos-text-muted">Loading settings...</div>
            </div>
          ) : (
            <div className="bg-hos-bg-secondary rounded-lg shadow p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-2">
                  Site Name
                </label>
                <input
                  type="text"
                  value={settings.siteName || ''}
                  onChange={(e) => handleChange('siteName', e.target.value)}
                  className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50"
                  placeholder="Enter site name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-2">
                  Site Description
                </label>
                <textarea
                  value={settings.siteDescription || ''}
                  onChange={(e) => handleChange('siteDescription', e.target.value)}
                  className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50"
                  rows={3}
                  placeholder="Enter site description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-2">
                  Default Language
                </label>
                <select
                  value={settings.defaultLanguage || 'en'}
                  onChange={(e) => handleChange('defaultLanguage', e.target.value)}
                  className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50"
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
                  <span className="text-sm font-medium text-hos-text-secondary">
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
                  <span className="text-sm font-medium text-hos-text-secondary">
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

