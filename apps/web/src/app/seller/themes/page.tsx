'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { DashboardLayout } from '@/components/DashboardLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import Image from 'next/image';

interface Theme {
  id: string;
  name: string;
  type: string;
  description?: string;
  version: number;
  versionString?: string;
  isActive: boolean;
  previewImages?: string[];
  config?: any;
}

interface SellerTheme {
  theme: Theme | null;
  customSettings: {
    customLogoUrl?: string;
    customFaviconUrl?: string;
    customColors?: Record<string, string>;
  } | null;
}

export default function SellerThemesPage() {
  const toast = useToast();
  const [themes, setThemes] = useState<Theme[]>([]);
  const [currentTheme, setCurrentTheme] = useState<SellerTheme | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTheme, setSelectedTheme] = useState<Theme | null>(null);
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Customization form
  const [customForm, setCustomForm] = useState({
    customLogoUrl: '',
    customFaviconUrl: '',
  });

  const menuItems = [
    { title: 'Dashboard', href: '/seller/dashboard', icon: '📊' },
    { title: 'Submit Product', href: '/seller/submit-product', icon: '➕' },
    { title: 'My Products', href: '/seller/products', icon: '📦' },
    { title: 'Orders', href: '/seller/orders', icon: '🛒' },
    { title: 'Submissions', href: '/seller/submissions', icon: '📝' },
    { title: 'Theme Selection', href: '/seller/themes', icon: '🎨' },
  ];

  useEffect(() => {
    fetchThemes();
    fetchCurrentTheme();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchThemes = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getThemes('SELLER');
      if (response?.data) {
        // Filter only active themes
        setThemes(response.data.filter((t: Theme) => t.isActive));
      }
    } catch (err: any) {
      console.error('Error fetching themes:', err);
      toast.error(err.message || 'Failed to load themes');
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentTheme = async () => {
    try {
      const response = await apiClient.getSellerTheme();
      if (response?.data) {
        setCurrentTheme(response.data);
        if (response.data.customSettings) {
          setCustomForm({
            customLogoUrl: response.data.customSettings.customLogoUrl || '',
            customFaviconUrl: response.data.customSettings.customFaviconUrl || '',
          });
        }
      }
    } catch (err: any) {
      console.error('Error fetching current theme:', err);
    }
  };

  const handleSelectTheme = async (theme: Theme) => {
    try {
      setActionLoading(true);
      await toast.promise(
        apiClient.updateSellerTheme({ themeId: theme.id }),
        {
          loading: 'Applying theme...',
          success: 'Theme applied successfully',
          error: (err) => err.message || 'Failed to apply theme',
        }
      );
      await fetchCurrentTheme();
    } catch (err: any) {
      console.error('Error selecting theme:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCustomize = (theme: Theme) => {
    setSelectedTheme(theme);
    setShowCustomizeModal(true);
  };

  const handleSaveCustomization = async () => {
    if (!selectedTheme) return;

    try {
      setActionLoading(true);
      await toast.promise(
        apiClient.updateSellerTheme({
          themeId: selectedTheme.id,
          customLogoUrl: customForm.customLogoUrl || undefined,
          customFaviconUrl: customForm.customFaviconUrl || undefined,
        }),
        {
          loading: 'Saving customization...',
          success: 'Customization saved successfully',
          error: (err) => err.message || 'Failed to save customization',
        }
      );
      setShowCustomizeModal(false);
      await fetchCurrentTheme();
    } catch (err: any) {
      console.error('Error saving customization:', err);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <RouteGuard allowedRoles={['SELLER', 'B2C_SELLER', 'WHOLESALER', 'ADMIN']} showAccessDenied={true}>
      <DashboardLayout role="SELLER" menuItems={menuItems} title="Seller">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Theme Selection</h1>
          <p className="text-gray-600 mt-2">Choose and customize your store theme</p>
        </div>

        {/* Current Theme */}
        {currentTheme?.theme && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Current Theme</h2>
            <div className="flex items-center gap-4">
              {currentTheme.theme.previewImages && currentTheme.theme.previewImages.length > 0 && (
                <Image
                  src={currentTheme.theme.previewImages[0]}
                  alt={currentTheme.theme.name}
                  width={96}
                  height={96}
                  className="object-cover rounded-lg border border-gray-200"
                />
              )}
              <div className="flex-1">
                <h3 className="text-lg font-medium">{currentTheme.theme.name}</h3>
                <p className="text-sm text-gray-500">
                  Version {currentTheme.theme.versionString || currentTheme.theme.version}
                </p>
                {currentTheme.customSettings && (
                  <p className="text-xs text-gray-400 mt-1">Customized</p>
                )}
              </div>
              <button
                onClick={() => handleCustomize(currentTheme.theme!)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
              >
                Customize
              </button>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        )}

        {!loading && themes.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
            <p className="text-gray-500 text-lg">No themes available</p>
          </div>
        )}

        {!loading && themes.length > 0 && (
          <>
            <h2 className="text-xl font-semibold mb-4">Available Themes</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {themes.map((theme) => {
                const isCurrent = currentTheme?.theme?.id === theme.id;
                return (
                  <div
                    key={theme.id}
                    className={`bg-white border rounded-lg overflow-hidden hover:shadow-lg transition-shadow ${
                      isCurrent ? 'ring-2 ring-purple-500' : ''
                    }`}
                  >
                    {/* Preview */}
                    <div className="aspect-video bg-gray-100 relative">
                      {theme.previewImages && theme.previewImages.length > 0 ? (
                        <Image
                          src={theme.previewImages[0]}
                          alt={theme.name}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 100vw, 33vw"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <div className="text-center">
                            <div className="text-4xl mb-2">🎨</div>
                            <div className="text-sm">No Preview</div>
                          </div>
                        </div>
                      )}
                      {isCurrent && (
                        <div className="absolute top-2 right-2">
                          <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded">
                            Active
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Theme Info */}
                    <div className="p-4">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">{theme.name}</h3>
                      {theme.description && (
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{theme.description}</p>
                      )}
                      <div className="flex gap-2">
                        {!isCurrent ? (
                          <>
                            <button
                              onClick={() => handleSelectTheme(theme)}
                              disabled={actionLoading}
                              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50"
                            >
                              Apply
                            </button>
                            <button
                              onClick={() => handleCustomize(theme)}
                              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                            >
                              Customize
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleCustomize(theme)}
                            className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                          >
                            Customize Theme
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Customize Modal */}
        {showCustomizeModal && selectedTheme && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-lg max-w-md w-full my-4">
              <div className="p-4 sm:p-6">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-2xl font-bold">Customize Theme</h2>
                  <button
                    onClick={() => setShowCustomizeModal(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Custom Logo URL
                    </label>
                    <input
                      type="url"
                      value={customForm.customLogoUrl}
                      onChange={(e) => setCustomForm({ ...customForm, customLogoUrl: e.target.value })}
                      placeholder="https://example.com/logo.png"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Custom Favicon URL
                    </label>
                    <input
                      type="url"
                      value={customForm.customFaviconUrl}
                      onChange={(e) =>
                        setCustomForm({ ...customForm, customFaviconUrl: e.target.value })
                      }
                      placeholder="https://example.com/favicon.ico"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={handleSaveCustomization}
                      disabled={actionLoading}
                      className="flex-1 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50"
                    >
                      {actionLoading ? 'Saving...' : 'Save Customization'}
                    </button>
                    <button
                      onClick={() => setShowCustomizeModal(false)}
                      disabled={actionLoading}
                      className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </DashboardLayout>
    </RouteGuard>
  );
}

