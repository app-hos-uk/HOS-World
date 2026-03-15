'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { SafeImage } from '@/components/SafeImage';

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
  metadata?: {
    fandom?: string;
    category?: string;
    price?: number;
    isPaid?: boolean;
    tags?: string[];
    author?: string;
    features?: string[];
  };
}

interface SellerTheme {
  theme: Theme | null;
  customSettings: {
    customLogoUrl?: string;
    customFaviconUrl?: string;
    customColors?: Record<string, string>;
  } | null;
}

const FANDOM_CATEGORIES = [
  { value: 'ALL', label: 'All Themes' },
  { value: 'HARRY_POTTER', label: 'Harry Potter' },
  { value: 'MARVEL', label: 'Marvel' },
  { value: 'DC', label: 'DC Comics' },
  { value: 'STAR_WARS', label: 'Star Wars' },
  { value: 'ANIME', label: 'Anime' },
  { value: 'GAMING', label: 'Gaming' },
  { value: 'GENERIC', label: 'Generic' },
];

const PRICING_FILTERS = [
  { value: 'ALL', label: 'All' },
  { value: 'FREE', label: 'Free' },
  { value: 'PAID', label: 'Premium' },
];

function ThemeColorSwatch({ colors }: { colors?: Record<string, string> }) {
  if (!colors) return null;
  const swatchColors = [colors.primary, colors.secondary, colors.accent, colors.background].filter(Boolean);
  if (swatchColors.length === 0) return null;
  return (
    <div className="flex gap-1">
      {swatchColors.map((c, i) => (
        <div key={i} className="w-4 h-4 rounded-full border border-gray-200" style={{ backgroundColor: c }} />
      ))}
    </div>
  );
}

export default function SellerThemesPage() {
  const toast = useToast();
  const { user, effectiveRole } = useAuth();
  const [themes, setThemes] = useState<Theme[]>([]);
  const [currentTheme, setCurrentTheme] = useState<SellerTheme | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Filters
  const [fandomFilter, setFandomFilter] = useState('ALL');
  const [pricingFilter, setPricingFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Preview modal
  const [previewTheme, setPreviewTheme] = useState<Theme | null>(null);

  // Customization modal
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [customizingTheme, setCustomizingTheme] = useState<Theme | null>(null);
  const [customForm, setCustomForm] = useState({
    customLogoUrl: '',
    customFaviconUrl: '',
  });

  const currentRole = effectiveRole || user?.role;
  const isWholesaler = currentRole === 'WHOLESALER';
  const menuItems = useMemo(
    () =>
      isWholesaler
        ? [
            { title: 'Dashboard', href: '/wholesaler/dashboard', icon: '📊' },
            { title: 'Submit Product', href: '/seller/submit-product', icon: '➕' },
            { title: 'My Products', href: '/wholesaler/products', icon: '📦' },
            { title: 'Bulk Orders', href: '/wholesaler/orders', icon: '🛒' },
            { title: 'Submissions', href: '/wholesaler/submissions', icon: '📝' },
            { title: 'Theme Marketplace', href: '/seller/themes', icon: '🎨' },
          ]
        : [
            { title: 'Dashboard', href: '/seller/dashboard', icon: '📊' },
            { title: 'Submit Product', href: '/seller/submit-product', icon: '➕' },
            { title: 'My Products', href: '/seller/products', icon: '📦' },
            { title: 'Orders', href: '/seller/orders', icon: '🛒' },
            { title: 'Submissions', href: '/seller/submissions', icon: '📝' },
            { title: 'Theme Marketplace', href: '/seller/themes', icon: '🎨' },
          ],
    [isWholesaler]
  );

  const fetchThemes = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.getThemes('SELLER');
      if (response?.data) {
        setThemes(response.data.filter((t: Theme) => t.isActive));
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load themes');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCurrentTheme = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchThemes();
    fetchCurrentTheme();
  }, [fetchThemes, fetchCurrentTheme]);

  const filteredThemes = useMemo(() => {
    return themes.filter(theme => {
      if (fandomFilter !== 'ALL') {
        const themeFandom = theme.metadata?.fandom || theme.metadata?.category || 'GENERIC';
        if (themeFandom.toUpperCase() !== fandomFilter) return false;
      }
      if (pricingFilter === 'FREE' && theme.metadata?.isPaid) return false;
      if (pricingFilter === 'PAID' && !theme.metadata?.isPaid) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matches =
          theme.name.toLowerCase().includes(q) ||
          theme.description?.toLowerCase().includes(q) ||
          theme.metadata?.fandom?.toLowerCase().includes(q) ||
          theme.metadata?.tags?.some(t => t.toLowerCase().includes(q));
        if (!matches) return false;
      }
      return true;
    });
  }, [themes, fandomFilter, pricingFilter, searchQuery]);

  const themeStats = useMemo(() => ({
    total: themes.length,
    free: themes.filter(t => !t.metadata?.isPaid).length,
    premium: themes.filter(t => t.metadata?.isPaid).length,
  }), [themes]);

  const handleInstallTheme = async (theme: Theme) => {
    try {
      setActionLoading(true);
      await toast.promise(
        apiClient.updateSellerTheme({ themeId: theme.id }),
        {
          loading: 'Installing theme...',
          success: `${theme.name} installed successfully!`,
          error: (err: any) => err.message || 'Failed to install theme',
        }
      );
      await fetchCurrentTheme();
      setPreviewTheme(null);
    } catch (err: any) {
      console.error('Error installing theme:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCustomize = (theme: Theme) => {
    setCustomizingTheme(theme);
    setShowCustomizeModal(true);
  };

  const handleSaveCustomization = async () => {
    if (!customizingTheme) return;
    try {
      setActionLoading(true);
      await toast.promise(
        apiClient.updateSellerTheme({
          themeId: customizingTheme.id,
          customLogoUrl: customForm.customLogoUrl || undefined,
          customFaviconUrl: customForm.customFaviconUrl || undefined,
        }),
        {
          loading: 'Saving customization...',
          success: 'Customization saved!',
          error: (err: any) => err.message || 'Failed to save',
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
      <DashboardLayout
        role={isWholesaler ? 'WHOLESALER' : 'SELLER'}
        menuItems={menuItems}
        title={isWholesaler ? 'Wholesaler' : 'Seller'}
      >
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Theme Marketplace</h1>
              <p className="text-gray-500 mt-1">Browse, preview, and install fandom-themed store designs</p>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full font-medium">
                {themeStats.total} Themes
              </span>
              <span className="px-3 py-1.5 bg-green-50 text-green-700 rounded-full font-medium">
                {themeStats.free} Free
              </span>
              {themeStats.premium > 0 && (
                <span className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-full font-medium">
                  {themeStats.premium} Premium
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Current Theme Banner */}
        {currentTheme?.theme && (
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-6 mb-8 text-white">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-16 h-16 bg-white/20 rounded-lg overflow-hidden flex-shrink-0">
                {currentTheme.theme.previewImages?.[0] ? (
                  <SafeImage
                    src={currentTheme.theme.previewImages[0]}
                    alt={currentTheme.theme.name}
                    width={64}
                    height={64}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl">🎨</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs uppercase tracking-wider text-purple-200">Active Theme</span>
                </div>
                <h2 className="text-xl font-bold">{currentTheme.theme.name}</h2>
                <p className="text-sm text-purple-200">
                  v{currentTheme.theme.versionString || currentTheme.theme.version}
                  {currentTheme.customSettings?.customLogoUrl && ' · Custom logo applied'}
                </p>
              </div>
              <button
                onClick={() => handleCustomize(currentTheme.theme!)}
                className="px-5 py-2.5 bg-white text-purple-700 rounded-lg hover:bg-purple-50 transition-colors font-semibold text-sm"
              >
                Customize
              </button>
            </div>
          </div>
        )}

        {/* Search & Filters */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search themes by name, fandom, or keyword..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-purple-500 focus:border-purple-500"
              />
            </div>

            {/* Fandom Filter */}
            <div className="flex flex-wrap gap-2">
              {FANDOM_CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  onClick={() => setFandomFilter(cat.value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                    fandomFilter === cat.value
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Pricing Filter */}
            <div className="flex gap-2">
              {PRICING_FILTERS.map(pf => (
                <button
                  key={pf.value}
                  onClick={() => setPricingFilter(pf.value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                    pricingFilter === pf.value
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {pf.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Theme Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-pulse">
                <div className="aspect-video bg-gray-200" />
                <div className="p-4 space-y-3">
                  <div className="h-5 bg-gray-200 rounded w-2/3" />
                  <div className="h-4 bg-gray-200 rounded w-full" />
                  <div className="h-9 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredThemes.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🎨</div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No themes found</h3>
            <p className="text-gray-500 text-sm">
              {searchQuery || fandomFilter !== 'ALL' || pricingFilter !== 'ALL'
                ? 'Try adjusting your filters or search query'
                : 'New themes will be added regularly. Check back soon!'}
            </p>
            {(searchQuery || fandomFilter !== 'ALL' || pricingFilter !== 'ALL') && (
              <button
                onClick={() => { setSearchQuery(''); setFandomFilter('ALL'); setPricingFilter('ALL'); }}
                className="mt-3 text-purple-600 hover:text-purple-700 font-medium text-sm"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredThemes.map(theme => {
              const isCurrent = currentTheme?.theme?.id === theme.id;
              const isPaid = theme.metadata?.isPaid;
              const price = theme.metadata?.price;

              return (
                <div
                  key={theme.id}
                  className={`group bg-white rounded-xl border overflow-hidden transition-all duration-200 hover:shadow-lg ${
                    isCurrent ? 'ring-2 ring-purple-500 border-purple-200' : 'border-gray-200 hover:border-purple-200'
                  }`}
                >
                  {/* Preview Image */}
                  <div
                    className="aspect-video bg-gray-100 relative cursor-pointer overflow-hidden"
                    onClick={() => setPreviewTheme(theme)}
                  >
                    {theme.previewImages?.[0] ? (
                      <SafeImage
                        src={theme.previewImages[0]}
                        alt={theme.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 768px) 100vw, 33vw"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-4xl mb-2 group-hover:scale-110 transition-transform">🎨</div>
                          <p className="text-xs text-gray-400">Click to preview</p>
                        </div>
                      </div>
                    )}

                    {/* Overlay on hover */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity px-4 py-2 bg-white/90 text-gray-900 text-sm font-medium rounded-lg shadow-lg">
                        Preview Theme
                      </span>
                    </div>

                    {/* Badges */}
                    <div className="absolute top-2 left-2 flex gap-1.5">
                      {isCurrent && (
                        <span className="px-2 py-0.5 text-xs font-semibold bg-purple-600 text-white rounded-md shadow-sm">
                          Active
                        </span>
                      )}
                      {isPaid ? (
                        <span className="px-2 py-0.5 text-xs font-semibold bg-amber-500 text-white rounded-md shadow-sm">
                          ${price || 'Premium'}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs font-semibold bg-green-500 text-white rounded-md shadow-sm">
                          Free
                        </span>
                      )}
                    </div>

                    {/* Fandom Badge */}
                    {theme.metadata?.fandom && (
                      <span className="absolute bottom-2 right-2 px-2 py-0.5 text-xs bg-black/60 text-white rounded-md backdrop-blur-sm">
                        {theme.metadata.fandom}
                      </span>
                    )}
                  </div>

                  {/* Theme Info */}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{theme.name}</h3>
                        {theme.metadata?.author && (
                          <p className="text-xs text-gray-400">by {theme.metadata.author}</p>
                        )}
                      </div>
                      <ThemeColorSwatch colors={theme.config?.colors} />
                    </div>

                    {theme.description && (
                      <p className="text-sm text-gray-500 mb-3 line-clamp-2">{theme.description}</p>
                    )}

                    {/* Tags */}
                    {theme.metadata?.tags && theme.metadata.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {theme.metadata.tags.slice(0, 3).map(tag => (
                          <span key={tag} className="px-2 py-0.5 text-xs bg-gray-100 text-gray-500 rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      {isCurrent ? (
                        <button
                          onClick={() => handleCustomize(theme)}
                          className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm"
                        >
                          Customize
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => handleInstallTheme(theme)}
                            disabled={actionLoading}
                            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm disabled:opacity-50"
                          >
                            {actionLoading ? 'Installing...' : 'Install'}
                          </button>
                          <button
                            onClick={() => setPreviewTheme(theme)}
                            className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                            title="Preview"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Theme Preview Modal */}
        {previewTheme && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" onClick={() => setPreviewTheme(null)} />
            <div className="relative bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              {/* Preview Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{previewTheme.name}</h2>
                  <p className="text-sm text-gray-500">
                    v{previewTheme.versionString || previewTheme.version}
                    {previewTheme.metadata?.author && ` · by ${previewTheme.metadata.author}`}
                  </p>
                </div>
                <button onClick={() => setPreviewTheme(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Preview Images */}
              <div className="bg-gray-100">
                {previewTheme.previewImages && previewTheme.previewImages.length > 0 ? (
                  <div className="space-y-1">
                    {previewTheme.previewImages.map((img, i) => (
                      <div key={i} className="relative w-full aspect-video">
                        <SafeImage src={img} alt={`${previewTheme.name} preview ${i + 1}`} fill className="object-contain" sizes="100vw" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-20">
                    <div className="text-center">
                      <div className="text-6xl mb-3">🎨</div>
                      <p className="text-gray-500">No preview images available</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Theme Details */}
              <div className="p-6">
                {previewTheme.description && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-700 uppercase mb-2">Description</h3>
                    <p className="text-gray-600">{previewTheme.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                  {previewTheme.metadata?.fandom && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase mb-1">Fandom</p>
                      <p className="text-sm font-medium text-gray-900">{previewTheme.metadata.fandom}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-500 uppercase mb-1">Price</p>
                    <p className="text-sm font-medium text-gray-900">
                      {previewTheme.metadata?.isPaid ? `$${previewTheme.metadata.price || '—'}` : 'Free'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase mb-1">Version</p>
                    <p className="text-sm font-medium text-gray-900">{previewTheme.versionString || previewTheme.version}</p>
                  </div>
                </div>

                {/* Color Palette */}
                {previewTheme.config?.colors && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-700 uppercase mb-2">Color Palette</h3>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(previewTheme.config.colors as Record<string, string | Record<string, string>>).map(([name, value]) => {
                        if (typeof value === 'object') {
                          return Object.entries(value).map(([sub, subVal]) => (
                            <div key={`${name}-${sub}`} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                              <div className="w-6 h-6 rounded-md border border-gray-200" style={{ backgroundColor: subVal }} />
                              <span className="text-xs text-gray-600">{name}.{sub}</span>
                            </div>
                          ));
                        }
                        return (
                          <div key={name} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                            <div className="w-6 h-6 rounded-md border border-gray-200" style={{ backgroundColor: value }} />
                            <span className="text-xs text-gray-600">{name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Features */}
                {previewTheme.metadata?.features && previewTheme.metadata.features.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-700 uppercase mb-2">Features</h3>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {previewTheme.metadata.features.map((feature, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                          <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Install Button */}
                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  {currentTheme?.theme?.id === previewTheme.id ? (
                    <button
                      onClick={() => { setPreviewTheme(null); handleCustomize(previewTheme); }}
                      className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors font-semibold"
                    >
                      Customize Active Theme
                    </button>
                  ) : (
                    <button
                      onClick={() => handleInstallTheme(previewTheme)}
                      disabled={actionLoading}
                      className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors font-semibold disabled:opacity-50"
                    >
                      {actionLoading ? 'Installing...' : `Install ${previewTheme.metadata?.isPaid ? `· $${previewTheme.metadata.price}` : '· Free'}`}
                    </button>
                  )}
                  <button
                    onClick={() => setPreviewTheme(null)}
                    className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Customization Modal */}
        {showCustomizeModal && customizingTheme && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowCustomizeModal(false)} />
            <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full">
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Customize Theme</h2>
                    <p className="text-sm text-gray-500 mt-1">{customizingTheme.name}</p>
                  </div>
                  <button onClick={() => setShowCustomizeModal(false)} className="p-1.5 hover:bg-gray-100 rounded-full">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Custom Logo URL</label>
                    <input
                      type="url"
                      value={customForm.customLogoUrl}
                      onChange={(e) => setCustomForm(prev => ({ ...prev, customLogoUrl: e.target.value }))}
                      placeholder="https://your-brand.com/logo.png"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-purple-500 focus:border-purple-500"
                    />
                    {customForm.customLogoUrl && (
                      <div className="mt-2 p-2 bg-gray-50 rounded-lg">
                        <SafeImage src={customForm.customLogoUrl} alt="Logo preview" width={120} height={40} className="object-contain" />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Custom Favicon URL</label>
                    <input
                      type="url"
                      value={customForm.customFaviconUrl}
                      onChange={(e) => setCustomForm(prev => ({ ...prev, customFaviconUrl: e.target.value }))}
                      placeholder="https://your-brand.com/favicon.ico"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={handleSaveCustomization}
                    disabled={actionLoading}
                    className="flex-1 px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold text-sm disabled:opacity-50"
                  >
                    {actionLoading ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => setShowCustomizeModal(false)}
                    disabled={actionLoading}
                    className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </DashboardLayout>
    </RouteGuard>
  );
}
