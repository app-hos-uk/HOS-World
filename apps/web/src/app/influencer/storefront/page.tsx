'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

interface Storefront {
  id: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
  layoutType: string;
  showBanner: boolean;
  showBio: boolean;
  showSocialLinks: boolean;
  metaTitle?: string;
  metaDescription?: string;
  featuredProductIds: string[];
  contentBlocks?: any[];
}

interface Influencer {
  displayName: string;
  slug: string;
  bio?: string;
  bannerImage?: string;
}

export default function InfluencerStorefrontPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Influencer | null>(null);
  const [storefront, setStorefront] = useState<Storefront>({
    id: '',
    primaryColor: '#7C3AED',
    secondaryColor: '#F3E8FF',
    backgroundColor: '#FFFFFF',
    textColor: '#1F2937',
    fontFamily: 'Inter',
    layoutType: 'grid',
    showBanner: true,
    showBio: true,
    showSocialLinks: true,
    featuredProductIds: [],
  });

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [profileRes, storefrontRes] = await Promise.all([
        apiClient.getMyInfluencerProfile(),
        apiClient.getMyStorefront(),
      ]);
      setProfile(profileRes.data);
      if (storefrontRes.data) {
        setStorefront({ ...storefront, ...storefrontRes.data });
      }
    } catch (err: any) {
      console.error('Error fetching storefront:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await apiClient.updateMyStorefront({
        primaryColor: storefront.primaryColor,
        secondaryColor: storefront.secondaryColor,
        backgroundColor: storefront.backgroundColor,
        textColor: storefront.textColor,
        fontFamily: storefront.fontFamily,
        layoutType: storefront.layoutType,
        showBanner: storefront.showBanner,
        showBio: storefront.showBio,
        showSocialLinks: storefront.showSocialLinks,
        metaTitle: storefront.metaTitle,
        metaDescription: storefront.metaDescription,
      });
      toast.success('Storefront settings saved successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const fonts = [
    'Inter', 'Roboto', 'Open Sans', 'Lato', 'Poppins', 
    'Montserrat', 'Playfair Display', 'Raleway'
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Storefront Editor</h1>
            <p className="text-gray-600 mt-1">
              Customize how your public storefront looks
            </p>
          </div>
          <div className="flex gap-3">
            {profile?.slug && (
              <Link
                href={`/i/${profile.slug}`}
                target="_blank"
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Preview
              </Link>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Settings Panel */}
          <div className="lg:col-span-2 space-y-6">
            {/* Theme Colors */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Theme Colors</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Primary Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={storefront.primaryColor}
                      onChange={(e) => setStorefront({ ...storefront, primaryColor: e.target.value })}
                      className="w-10 h-10 rounded border cursor-pointer"
                    />
                    <input
                      type="text"
                      value={storefront.primaryColor}
                      onChange={(e) => setStorefront({ ...storefront, primaryColor: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Secondary Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={storefront.secondaryColor}
                      onChange={(e) => setStorefront({ ...storefront, secondaryColor: e.target.value })}
                      className="w-10 h-10 rounded border cursor-pointer"
                    />
                    <input
                      type="text"
                      value={storefront.secondaryColor}
                      onChange={(e) => setStorefront({ ...storefront, secondaryColor: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Background Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={storefront.backgroundColor}
                      onChange={(e) => setStorefront({ ...storefront, backgroundColor: e.target.value })}
                      className="w-10 h-10 rounded border cursor-pointer"
                    />
                    <input
                      type="text"
                      value={storefront.backgroundColor}
                      onChange={(e) => setStorefront({ ...storefront, backgroundColor: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Text Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={storefront.textColor}
                      onChange={(e) => setStorefront({ ...storefront, textColor: e.target.value })}
                      className="w-10 h-10 rounded border cursor-pointer"
                    />
                    <input
                      type="text"
                      value={storefront.textColor}
                      onChange={(e) => setStorefront({ ...storefront, textColor: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Typography & Layout */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Typography & Layout</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Font Family
                  </label>
                  <select
                    value={storefront.fontFamily}
                    onChange={(e) => setStorefront({ ...storefront, fontFamily: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    {fonts.map((font) => (
                      <option key={font} value={font}>{font}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Layout Type
                  </label>
                  <select
                    value={storefront.layoutType}
                    onChange={(e) => setStorefront({ ...storefront, layoutType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="grid">Grid</option>
                    <option value="list">List</option>
                    <option value="masonry">Masonry</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Display Options */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Display Options</h2>
              <div className="space-y-4">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={storefront.showBanner}
                    onChange={(e) => setStorefront({ ...storefront, showBanner: e.target.checked })}
                    className="w-5 h-5 text-purple-600 rounded"
                  />
                  <span className="text-gray-700">Show banner image</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={storefront.showBio}
                    onChange={(e) => setStorefront({ ...storefront, showBio: e.target.checked })}
                    className="w-5 h-5 text-purple-600 rounded"
                  />
                  <span className="text-gray-700">Show bio/description</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={storefront.showSocialLinks}
                    onChange={(e) => setStorefront({ ...storefront, showSocialLinks: e.target.checked })}
                    className="w-5 h-5 text-purple-600 rounded"
                  />
                  <span className="text-gray-700">Show social media links</span>
                </label>
              </div>
            </div>

            {/* SEO Settings */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">SEO Settings</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Meta Title
                  </label>
                  <input
                    type="text"
                    value={storefront.metaTitle || ''}
                    onChange={(e) => setStorefront({ ...storefront, metaTitle: e.target.value })}
                    placeholder={profile?.displayName || 'My Storefront'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Meta Description
                  </label>
                  <textarea
                    value={storefront.metaDescription || ''}
                    onChange={(e) => setStorefront({ ...storefront, metaDescription: e.target.value })}
                    placeholder="A short description of your storefront for search engines"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Preview Panel */}
          <div className="lg:col-span-1">
            <div className="sticky top-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Preview</h3>
              <div
                className="rounded-xl overflow-hidden shadow-lg"
                style={{
                  backgroundColor: storefront.backgroundColor,
                  color: storefront.textColor,
                  fontFamily: storefront.fontFamily,
                }}
              >
                {/* Mini Preview */}
                {storefront.showBanner && (
                  <div
                    className="h-20"
                    style={{ backgroundColor: storefront.primaryColor }}
                  />
                )}
                <div className="p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="w-12 h-12 rounded-full"
                      style={{ backgroundColor: storefront.secondaryColor }}
                    />
                    <div>
                      <p className="font-semibold">{profile?.displayName || 'Your Name'}</p>
                      <p className="text-sm opacity-70">@{profile?.slug || 'yourslug'}</p>
                    </div>
                  </div>
                  {storefront.showBio && (
                    <p className="text-sm opacity-80 mb-4 line-clamp-2">
                      {profile?.bio || 'Your bio will appear here...'}
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    {[1, 2].map((i) => (
                      <div
                        key={i}
                        className="aspect-square rounded-lg"
                        style={{ backgroundColor: storefront.secondaryColor }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
    </div>
  );
}
