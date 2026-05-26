'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { ProductCard } from '@/components/ProductCard';
import { REFERENCE_DEMO_PRODUCTS } from '@/lib/referenceAssets';

type Tab = 'sale' | 'new' | 'top-rated';

interface Product {
  id: string;
  name: string;
  price: number;
  rrp?: number;
  images?: Array<{ url: string; alt?: string }>;
  averageRating?: number;
  fandom?: string;
  seller?: { storeName?: string };
}

function mapDemoProducts(tab: Tab) {
  if (tab === 'sale') {
    return REFERENCE_DEMO_PRODUCTS.filter((p) => 'badge' in p && p.badge === 'sale').slice(0, 5);
  }
  if (tab === 'new') {
    return REFERENCE_DEMO_PRODUCTS.filter((p) => 'badge' in p && p.badge === 'new').slice(0, 5);
  }
  return REFERENCE_DEMO_PRODUCTS.filter((p) => !('badge' in p)).slice(0, 5);
}

export default function WeeklyPicks() {
  const [activeTab, setActiveTab] = useState<Tab>('sale');
  const [products, setProducts] = useState<Product[]>([]);
  const [usingDemo, setUsingDemo] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts(activeTab);
  }, [activeTab]);

  const fetchProducts = async (tab: Tab) => {
    setLoading(true);
    try {
      let params: Record<string, string | number> = { limit: 10, status: 'ACTIVE' };
      if (tab === 'sale') params.sortBy = 'price_asc';
      else if (tab === 'new') params.sortBy = 'newest';
      else params.sortBy = 'popular';

      const response = await apiClient.getProducts(params as any);
      const data = response?.data;
      const items = Array.isArray(data) ? data : (data as any)?.items || (data as any)?.data || [];
      const list = Array.isArray(items) ? items.slice(0, 10) : [];

      if (list.length > 0) {
        setProducts(list);
        setUsingDemo(false);
      } else {
        setProducts(mapDemoProducts(tab) as unknown as Product[]);
        setUsingDemo(true);
      }
    } catch {
      setProducts(mapDemoProducts(tab) as unknown as Product[]);
      setUsingDemo(true);
    } finally {
      setLoading(false);
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'sale', label: 'On sale' },
    { key: 'new', label: 'New arrivals' },
    { key: 'top-rated', label: 'Popular picks' },
  ];

  return (
    <section className="max-w-7xl mx-auto px-4 py-12">
      <div className="mb-8 section-head">
        <h2 className="font-display text-hos-gold-hover text-2xl md:text-3xl">
          This week on the marketplace
        </h2>
        <p className="text-hos-text-muted text-sm mt-1 font-body">
          Rotating picks from vendors across the marketplace.
        </p>
      </div>

      {usingDemo && !loading && (
        <p className="mb-4 text-xs text-hos-text-muted bg-hos-bg-secondary border border-hos-border rounded-lg px-3 py-2" role="status">
          Showing sample products while live listings load.
        </p>
      )}

      <div
        className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide"
        role="tablist"
        aria-label="Weekly product picks"
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-ui font-semibold rounded-full whitespace-nowrap transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hos-gold-ring ${
              activeTab === tab.key
                ? 'bg-gradient-to-b from-hos-gold-hover to-hos-gold text-[#1a1406]'
                : 'bg-hos-bg-secondary border border-hos-border text-hos-text-muted hover:border-hos-border-accent hover:text-hos-text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" aria-label={tabs.find((t) => t.key === activeTab)?.label}>
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="product-card-ref animate-pulse">
                <div className="aspect-square bg-hos-bg-tertiary" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-hos-bg-tertiary rounded w-full" />
                  <div className="h-8 bg-hos-bg-tertiary rounded w-full mt-2" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {products.map((product) => {
              const demo = usingDemo && 'image' in (product as any);
              const p = product as any;
              const hasDiscount = product.rrp && product.rrp > product.price;
              return (
                <ProductCard
                  key={product.id}
                  id={product.id}
                  name={product.name}
                  price={product.price}
                  rrp={product.rrp}
                  images={product.images}
                  imageUrl={p.image}
                  averageRating={product.averageRating ?? p.averageRating}
                  vendor={product.seller?.storeName ?? p.vendor}
                  badge={activeTab === 'new' ? 'new' : hasDiscount ? 'sale' : null}
                  demo={demo}
                />
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
