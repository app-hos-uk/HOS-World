'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { GoogleFontLink } from '@/components/GoogleFontLink';

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
  contentBlocks?: unknown[];
}

interface Influencer {
  displayName: string;
  slug: string;
  bio?: string;
  bannerImage?: string;
}

interface CatalogProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  images: Array<{ url: string }>;
}

const HEX_COLOR_REGEX = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

function isValidHexColor(value: string): boolean {
  return HEX_COLOR_REGEX.test(value.trim());
}

function validateStorefrontColors(storefront: Storefront): string | null {
  const fields: Array<{ key: keyof Storefront; label: string }> = [
    { key: 'primaryColor', label: 'Primary Color' },
    { key: 'secondaryColor', label: 'Secondary Color' },
    { key: 'backgroundColor', label: 'Background Color' },
    { key: 'textColor', label: 'Text Color' },
  ];
  for (const { key, label } of fields) {
    const value = storefront[key] as string;
    if (!isValidHexColor(value)) {
      return `${label} must be a valid hex color (e.g. #7C3AED or #FFF)`;
    }
  }
  return null;
}

export default function InfluencerStorefrontPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Influencer | null>(null);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [colorError, setColorError] = useState<string | null>(null);
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
      const [profileRes, storefrontRes, productsRes] = await Promise.all([
        apiClient.getMyInfluencerProfile(),
        apiClient.getMyStorefront(),
        apiClient.getProducts({ status: 'ACTIVE', limit: 100 }),
      ]);
      setProfile(profileRes.data);
      if (storefrontRes.data) {
        setStorefront((prev) => ({
          ...prev,
          ...storefrontRes.data,
          featuredProductIds: storefrontRes.data.featuredProductIds ?? [],
        }));
      }
      const raw = productsRes.data;
      const list = Array.isArray(raw) ? raw : (raw as { data?: CatalogProduct[] })?.data ?? [];
      setProducts(list);
    } catch {
      console.error('Failed to load storefront settings');
      toast.error('Failed to load storefront settings');
    } finally {
      setLoading(false);
    }
  };

  const toggleFeaturedProduct = (productId: string) => {
    setStorefront((prev) => {
      const ids = prev.featuredProductIds;
      if (ids.includes(productId)) {
        return { ...prev, featuredProductIds: ids.filter((id) => id !== productId) };
      }
      return { ...prev, featuredProductIds: [...ids, productId] };
    });
  };

  const moveFeaturedProduct = (index: number, direction: 'up' | 'down') => {
    setStorefront((prev) => {
      const ids = [...prev.featuredProductIds];
      const swapIndex = direction === 'up' ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= ids.length) return prev;
      [ids[index], ids[swapIndex]] = [ids[swapIndex], ids[index]];
      return { ...prev, featuredProductIds: ids };
    });
  };

  const handleColorChange = (field: keyof Pick<Storefront, 'primaryColor' | 'secondaryColor' | 'backgroundColor' | 'textColor'>, value: string) => {
    setStorefront((prev) => ({ ...prev, [field]: value }));
    setColorError(null);
  };

  const handleSave = async () => {
    const validationError = validateStorefrontColors(storefront);
    if (validationError) {
      setColorError(validationError);
      toast.error(validationError);
      return;
    }
    setColorError(null);

    try {
      setSaving(true);
      await Promise.all([
        apiClient.updateMyStorefront({
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
        }),
        apiClient.updateStorefrontFeaturedProducts(storefront.featuredProductIds),
      ]);
      toast.success('Storefront settings saved successfully');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save settings';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };


  const filteredCatalogProducts = useMemo(() => {
    const q = productSearch.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, productSearch]);

  const fonts = [
    'Inter', 'Roboto', 'Open Sans', 'Lato', 'Poppins', 
    'Montserrat', 'Playfair Display', 'Raleway'
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-hos-gold"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <GoogleFontLink family={storefront.fontFamily} />
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-hos-text-secondary">Storefront Editor</h1>
            <p className="text-hos-text-secondary mt-1">
              Customize how your public storefront looks
            </p>
          </div>
          <div className="flex gap-3">
            {profile?.slug && (
              <Link
                href={`/i/${profile.slug}`}
                target="_blank"
                className="px-4 py-2 border border-hos-border text-hos-text-secondary rounded-lg hover:bg-hos-bg-tertiary transition-colors flex items-center gap-2"
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
              className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Settings Panel */}
          <div className="lg:col-span-2 space-y-6">
            {/* Theme Colors */}
            <div className="bg-hos-bg-secondary rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-hos-text-secondary mb-4">Theme Colors</h2>
              {colorError && (
                <p className="mb-4 text-sm text-red-400">{colorError}</p>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-hos-text-secondary mb-2">
                    Primary Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={storefront.primaryColor}
                      onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                      className="w-10 h-10 rounded border cursor-pointer"
                    />
                    <input
                      type="text"
                      value={storefront.primaryColor}
                      onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                      className="flex-1 px-3 py-2 border border-hos-border rounded-lg"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-hos-text-secondary mb-2">
                    Secondary Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={storefront.secondaryColor}
                      onChange={(e) => handleColorChange('secondaryColor', e.target.value)}
                      className="w-10 h-10 rounded border cursor-pointer"
                    />
                    <input
                      type="text"
                      value={storefront.secondaryColor}
                      onChange={(e) => handleColorChange('secondaryColor', e.target.value)}
                      className="flex-1 px-3 py-2 border border-hos-border rounded-lg"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-hos-text-secondary mb-2">
                    Background Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={storefront.backgroundColor}
                      onChange={(e) => handleColorChange('backgroundColor', e.target.value)}
                      className="w-10 h-10 rounded border cursor-pointer"
                    />
                    <input
                      type="text"
                      value={storefront.backgroundColor}
                      onChange={(e) => handleColorChange('backgroundColor', e.target.value)}
                      className="flex-1 px-3 py-2 border border-hos-border rounded-lg"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-hos-text-secondary mb-2">
                    Text Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={storefront.textColor}
                      onChange={(e) => handleColorChange('textColor', e.target.value)}
                      className="w-10 h-10 rounded border cursor-pointer"
                    />
                    <input
                      type="text"
                      value={storefront.textColor}
                      onChange={(e) => handleColorChange('textColor', e.target.value)}
                      className="flex-1 px-3 py-2 border border-hos-border rounded-lg"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Typography & Layout */}
            <div className="bg-hos-bg-secondary rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-hos-text-secondary mb-4">Typography & Layout</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-hos-text-secondary mb-2">
                    Font Family
                  </label>
                  <select
                    value={storefront.fontFamily}
                    onChange={(e) => setStorefront({ ...storefront, fontFamily: e.target.value })}
                    className="w-full px-3 py-2 border border-hos-border rounded-lg"
                  >
                    {fonts.map((font) => (
                      <option key={font} value={font}>{font}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-hos-text-secondary mb-2">
                    Layout Type
                  </label>
                  <select
                    value={storefront.layoutType}
                    onChange={(e) => setStorefront({ ...storefront, layoutType: e.target.value })}
                    className="w-full px-3 py-2 border border-hos-border rounded-lg"
                  >
                    <option value="grid">Grid</option>
                    <option value="list">List</option>
                    <option value="masonry">Masonry</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Featured Products */}
            <div className="bg-hos-bg-secondary rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-hos-text-secondary mb-2">Featured Products</h2>
              <p className="text-sm text-hos-text-muted mb-4">
                Choose products to highlight on your public storefront. Drag order with the arrows.
              </p>

              {storefront.featuredProductIds.length > 0 && (
                <div className="mb-4 space-y-2">
                  <p className="text-xs font-medium text-hos-text-muted uppercase tracking-wide">Selected ({storefront.featuredProductIds.length})</p>
                  {storefront.featuredProductIds.map((productId, index) => {
                    const product = products.find((p) => p.id === productId);
                    return (
                      <div
                        key={productId}
                        className="flex items-center gap-3 p-3 rounded-lg bg-hos-bg-tertiary border border-hos-border"
                      >
                        {product?.images?.[0] ? (
                          <Image
                            src={product.images[0].url}
                            alt={product.name}
                            width={40}
                            height={40}
                            className="object-cover rounded"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-hos-bg-secondary rounded flex-shrink-0" />
                        )}
                        <span className="flex-1 text-sm font-medium text-hos-text-secondary truncate">
                          {product?.name ?? productId}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => moveFeaturedProduct(index, 'up')}
                            disabled={index === 0}
                            className="p-1 text-hos-text-muted hover:text-hos-gold disabled:opacity-30"
                            aria-label="Move up"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => moveFeaturedProduct(index, 'down')}
                            disabled={index === storefront.featuredProductIds.length - 1}
                            className="p-1 text-hos-text-muted hover:text-hos-gold disabled:opacity-30"
                            aria-label="Move down"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleFeaturedProduct(productId)}
                            className="p-1 text-red-400 hover:text-red-300"
                            aria-label="Remove"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <input
                type="text"
                placeholder="Search products to feature..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full px-3 py-2 border border-hos-border rounded-lg mb-3"
              />
              <div className="max-h-64 overflow-y-auto space-y-2">
                {filteredCatalogProducts.length === 0 ? (
                  <p className="text-sm text-hos-text-muted text-center py-4">No products found</p>
                ) : (
                  filteredCatalogProducts.map((product) => {
                    const isSelected = storefront.featuredProductIds.includes(product.id);
                    return (
                      <label
                        key={product.id}
                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                          isSelected ? 'bg-hos-gold/10 border border-hos-gold' : 'bg-hos-bg-tertiary hover:bg-hos-bg-secondary border border-transparent'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleFeaturedProduct(product.id)}
                          className="w-4 h-4 text-hos-gold rounded"
                        />
                        {product.images?.[0] ? (
                          <Image
                            src={product.images[0].url}
                            alt={product.name}
                            width={40}
                            height={40}
                            className="object-cover rounded"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-hos-bg-secondary rounded flex-shrink-0" />
                        )}
                        <span className="flex-1 text-sm text-hos-text-secondary truncate">{product.name}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            {/* Display Options */}
            <div className="bg-hos-bg-secondary rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-hos-text-secondary mb-4">Display Options</h2>
              <div className="space-y-4">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={storefront.showBanner}
                    onChange={(e) => setStorefront({ ...storefront, showBanner: e.target.checked })}
                    className="w-5 h-5 text-hos-gold rounded"
                  />
                  <span className="text-hos-text-secondary">Show banner image</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={storefront.showBio}
                    onChange={(e) => setStorefront({ ...storefront, showBio: e.target.checked })}
                    className="w-5 h-5 text-hos-gold rounded"
                  />
                  <span className="text-hos-text-secondary">Show bio/description</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={storefront.showSocialLinks}
                    onChange={(e) => setStorefront({ ...storefront, showSocialLinks: e.target.checked })}
                    className="w-5 h-5 text-hos-gold rounded"
                  />
                  <span className="text-hos-text-secondary">Show social media links</span>
                </label>
              </div>
            </div>

            {/* SEO Settings */}
            <div className="bg-hos-bg-secondary rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-hos-text-secondary mb-4">SEO Settings</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-hos-text-secondary mb-2">
                    Meta Title
                  </label>
                  <input
                    type="text"
                    value={storefront.metaTitle || ''}
                    onChange={(e) => setStorefront({ ...storefront, metaTitle: e.target.value })}
                    placeholder={profile?.displayName || 'My Storefront'}
                    className="w-full px-3 py-2 border border-hos-border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-hos-text-secondary mb-2">
                    Meta Description
                  </label>
                  <textarea
                    value={storefront.metaDescription || ''}
                    onChange={(e) => setStorefront({ ...storefront, metaDescription: e.target.value })}
                    placeholder="A short description of your storefront for search engines"
                    rows={3}
                    className="w-full px-3 py-2 border border-hos-border rounded-lg"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Preview Panel */}
          <div className="lg:col-span-1">
            <div className="sticky top-8">
              <h3 className="text-lg font-semibold text-hos-text-secondary mb-4">Preview</h3>
              <div
                className="rounded-xl overflow-hidden shadow-lg border border-hos-border"
                style={{
                  backgroundColor: storefront.backgroundColor,
                  color: storefront.textColor,
                  fontFamily: `"${storefront.fontFamily}", system-ui, sans-serif`,
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
                  {storefront.layoutType === 'list' ? (
                    <div className="flex flex-col gap-2">
                      {[1, 2].map((i) => (
                        <div
                          key={i}
                          className="flex flex-row gap-3 rounded-lg border border-black/5 p-2 items-center"
                          style={{ backgroundColor: `${storefront.secondaryColor}cc` }}
                        >
                          <div
                            className="w-14 h-14 rounded-md flex-shrink-0"
                            style={{ backgroundColor: storefront.secondaryColor }}
                          />
                          <div className="flex-1 min-w-0 text-left">
                            <p className="text-xs font-semibold truncate">Product {i}</p>
                            <p className="text-[10px] opacity-70">$19.99</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : storefront.layoutType === 'masonry' ? (
                    <div className="columns-2 gap-2 space-y-2">
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="break-inside-avoid rounded-lg mb-2 last:mb-0"
                          style={{
                            backgroundColor: storefront.secondaryColor,
                            minHeight: i === 2 ? '4.5rem' : '3rem',
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {[1, 2].map((i) => (
                        <div
                          key={i}
                          className="aspect-square rounded-lg"
                          style={{ backgroundColor: storefront.secondaryColor }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
    </div>
  );
}
