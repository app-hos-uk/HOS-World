'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { SocialShare } from '@/components/SocialShare';

interface ProductLink {
  id: string;
  productId: string;
  product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    images: Array<{ url: string }>;
  };
  clicks: number;
  conversions: number;
  referralUrl: string;
  createdAt: string;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  images: Array<{ url: string }>;
}

export default function InfluencerProductLinksPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [links, setLinks] = useState<ProductLink[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [creating, setCreating] = useState(false);
  const fetchGenerationRef = useRef(0);

  const loadData = useCallback(async () => {
    const generation = ++fetchGenerationRef.current;
    try {
      setLoading(true);
      setError(null);
      const [linksRes, productsRes] = await Promise.all([
        apiClient.getMyProductLinks({ limit: 100 }),
        apiClient.getProducts({ status: 'ACTIVE', limit: 100 }),
      ]);
      if (generation !== fetchGenerationRef.current) return;

      setLinks(linksRes.data || []);
      const raw = productsRes.data;
      const list = Array.isArray(raw) ? raw : (raw as { data?: Product[] })?.data ?? [];
      setProducts(list);
    } catch (err: unknown) {
      if (generation !== fetchGenerationRef.current) return;
      console.error('Failed to load product links');
      const message = err instanceof Error ? err.message : 'Failed to load product links';
      setError(message);
      toast.error(message);
    } finally {
      if (generation === fetchGenerationRef.current) {
        setLoading(false);
      }
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const fetchLinks = async () => {
    const generation = ++fetchGenerationRef.current;
    try {
      const response = await apiClient.getMyProductLinks({ limit: 100 });
      if (generation !== fetchGenerationRef.current) return;
      setLinks(response.data || []);
      setError(null);
    } catch (err: unknown) {
      if (generation !== fetchGenerationRef.current) return;
      console.error('Failed to refresh product links');
      const message = err instanceof Error ? err.message : 'Failed to load product links';
      setError(message);
      toast.error(message);
    }
  };

  const handleCreateLink = async () => {
    if (!selectedProductId) {
      toast.error('Please select a product');
      return;
    }

    try {
      setCreating(true);
      await apiClient.createProductLink(selectedProductId);
      toast.success('Product link created successfully');
      setShowAddModal(false);
      setSelectedProductId('');
      fetchLinks();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create product link');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteLink = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product link?')) return;

    try {
      await apiClient.deleteProductLink(id);
      toast.success('Product link deleted');
      fetchLinks();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete product link');
    }
  };

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${url}`);
      toast.success('Link copied to clipboard!');
    } catch {
      toast.error('Failed to copy link to clipboard');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Filter products not already linked
  const linkedProductIds = new Set(links.map(l => l.productId));
  const availableProducts = products.filter(p => !linkedProductIds.has(p.id));
  const filteredProducts = availableProducts.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-hos-gold"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-hos-text-secondary">Product Links</h1>
            <p className="text-hos-text-secondary mt-1">
              Create trackable links for products you want to promote
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Link
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 flex items-center justify-between gap-4">
            <p className="text-sm text-red-300">{error}</p>
            <button
              onClick={loadData}
              className="shrink-0 px-3 py-1.5 text-sm font-medium bg-red-500/20 text-red-200 rounded-lg hover:bg-red-500/30 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Links Grid */}
        {!error && links.length === 0 ? (
          <div className="bg-hos-bg-secondary rounded-xl p-12 text-center shadow-sm">
            <svg className="w-16 h-16 text-hos-text-muted mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <h3 className="text-lg font-medium text-hos-text-secondary mb-2">No product links yet</h3>
            <p className="text-hos-text-muted mb-4">Create your first product link to start tracking referrals</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover"
            >
              Create Your First Link
            </button>
          </div>
        ) : !error ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {links.map((link) => (
              <div key={link.id} className="bg-hos-bg-secondary rounded-xl shadow-sm overflow-hidden">
                <div className="relative h-48 bg-hos-bg-tertiary">
                  {link.product.images?.[0] ? (
                    <Image
                      src={link.product.images[0].url}
                      alt={link.product.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 50vw"
                    />
                  ) : (
                    <div className="w-full h-48 flex items-center justify-center bg-hos-bg-tertiary">
                      <svg className="w-12 h-12 text-hos-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-medium text-hos-text-secondary mb-1 line-clamp-2">
                    {link.product.name}
                  </h3>
                  <p className="text-hos-gold font-semibold mb-3">
                    {formatCurrency(link.product.price)}
                  </p>
                  
                  <div className="flex items-center gap-4 text-sm text-hos-text-muted mb-4">
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                      </svg>
                      {link.clicks} clicks
                    </span>
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {link.conversions} sales
                    </span>
                  </div>

                  <div className="flex gap-2 items-center">
                    <SocialShare
                      type="PRODUCT"
                      itemId={link.productId}
                      itemName={link.product.name}
                      itemImage={link.product.images?.[0]?.url || ''}
                    />
                    <button
                      onClick={() => copyLink(link.referralUrl)}
                      className="flex-1 px-3 py-2 bg-hos-gold/10 text-hos-gold rounded-lg hover:bg-hos-gold/20 transition-colors text-sm font-medium"
                    >
                      Copy Link
                    </button>
                    <button
                      onClick={() => handleDeleteLink(link.id)}
                      className="px-3 py-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {/* Add Product Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-hos-bg-secondary rounded-xl max-w-lg w-full max-h-[80vh] flex flex-col">
              <div className="p-6 border-b">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-hos-text-secondary">Create Product Link</h2>
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="text-hos-text-muted hover:text-hos-text-secondary"
                  >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              
              <div className="p-6 flex-1 overflow-auto">
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 border border-hos-border rounded-lg mb-4 focus:ring-2 focus:ring-hos-gold/50 focus:border-transparent"
                />
                
                <div className="space-y-2 max-h-64 overflow-auto">
                  {filteredProducts.length === 0 ? (
                    <p className="text-center text-hos-text-muted py-4">
                      {products.length === 0
                        ? 'No products in the marketplace yet. Products will appear here once added by sellers.'
                        : availableProducts.length === 0
                          ? 'All products have links already'
                          : 'No products found'}
                    </p>
                  ) : (
                    filteredProducts.map((product) => (
                      <label
                        key={product.id}
                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                          selectedProductId === product.id
                            ? 'bg-hos-gold/10 border-2 border-hos-gold'
                            : 'bg-hos-bg-secondary border-2 border-transparent hover:bg-hos-bg-tertiary'
                        }`}
                      >
                        <input
                          type="radio"
                          name="product"
                          value={product.id}
                          checked={selectedProductId === product.id}
                          onChange={(e) => setSelectedProductId(e.target.value)}
                          className="sr-only"
                        />
                        {product.images?.[0] ? (
                          <Image
                            src={product.images[0].url}
                            alt={product.name}
                            width={48}
                            height={48}
                            className="object-cover rounded"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-hos-bg-tertiary rounded flex items-center justify-center">
                            <svg className="w-6 h-6 text-hos-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-hos-text-secondary truncate">{product.name}</p>
                          <p className="text-sm text-hos-gold">{formatCurrency(product.price)}</p>
                        </div>
                        {selectedProductId === product.id && (
                          <svg className="w-5 h-5 text-hos-gold" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="p-6 border-t flex justify-end gap-3">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-hos-text-secondary hover:bg-hos-bg-tertiary rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateLink}
                  disabled={!selectedProductId || creating}
                  className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {creating ? 'Creating...' : 'Create Link'}
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
