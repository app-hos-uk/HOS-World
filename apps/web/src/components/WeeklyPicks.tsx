'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { ProductCard } from '@/components/ProductCard';

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

export default function WeeklyPicks() {
  const [activeTab, setActiveTab] = useState<Tab>('sale');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts(activeTab);
  }, [activeTab]);

  const fetchProducts = async (tab: Tab) => {
    setLoading(true);
    try {
      const sort = tab === 'sale' ? 'price_asc' : tab === 'new' ? 'newest' : 'popular';
      let list: Product[] = [];

      try {
        const searchResponse = await apiClient.searchProducts('', { sort, limit: 10, page: 1 });
        const searchData = searchResponse?.data as { products?: Product[] } | undefined;
        list = Array.isArray(searchData?.products) ? searchData.products.slice(0, 10) : [];
      } catch {
        // Fall through to REST API
      }

      if (list.length === 0) {
        const response = await apiClient.getProducts({ limit: 10, status: 'ACTIVE', sortBy: sort } as any);
        const data = response?.data;
        const items = Array.isArray(data) ? data : (data as any)?.data || [];
        list = Array.isArray(items) ? items.slice(0, 10) : [];
      }

      if (list.length > 0) {
        setProducts(list);
      } else {
        setProducts([]);
      }
    } catch {
      setProducts([]);
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
    <section className="max-w-7xl mx-auto px-4 py-12 sm:py-16">
      <div className="mb-8 section-head">
        <h2 className="font-display text-hos-gold-hover text-2xl md:text-3xl">
          This week on the marketplace
        </h2>
        <p className="text-hos-text-muted text-sm mt-1 font-body">
          Rotating picks from vendors across the marketplace.
        </p>
      </div>

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
        ) : products.length === 0 ? (
          <p className="text-hos-text-muted text-sm py-8 text-center">No products in this category yet. Check back soon.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {products.map((product) => {
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
                />
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
