'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { ProductCard } from '@/components/ProductCard';
import { REFERENCE_DEMO_PRODUCTS } from '@/lib/referenceAssets';

interface Product {
  id: string;
  name: string;
  price: number;
  rrp?: number;
  images?: Array<{ url: string; alt?: string }>;
  averageRating?: number;
  seller?: { storeName?: string };
}

const ENCHANTED_DEMO = REFERENCE_DEMO_PRODUCTS.filter((p) => !('badge' in p)).slice(0, 5);

export default function EnchantedFinds() {
  const [products, setProducts] = useState<Product[]>([]);
  const [usingDemo, setUsingDemo] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await apiClient.getProducts({ sort: 'rating', limit: 5, status: 'ACTIVE' } as any);
      const data = response?.data;
      const items = Array.isArray(data) ? data : (data as any)?.items || (data as any)?.data || [];
      const list = Array.isArray(items) ? items.slice(0, 5) : [];

      if (list.length > 0) {
        setProducts(list);
        setUsingDemo(false);
      } else {
        setProducts(ENCHANTED_DEMO as unknown as Product[]);
        setUsingDemo(true);
      }
    } catch {
      setProducts(ENCHANTED_DEMO as unknown as Product[]);
      setUsingDemo(true);
    } finally {
      setLoading(false);
    }
  };

  if (!loading && products.length === 0) return null;

  return (
    <section className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex items-end justify-between mb-8 gap-4 section-head">
        <div>
          <h2 className="font-display text-hos-gold-hover text-2xl md:text-3xl">
            Enchanted finds
          </h2>
          <p className="text-hos-text-muted text-sm mt-1 font-body">
            Replica props, jewelry, and gifts your fellow fans will recognise instantly.
          </p>
        </div>
        <Link
          href="/products?sort=rating"
          className="text-hos-gold text-sm font-ui font-semibold hover:text-hos-gold-hover transition-colors shrink-0"
        >
          View collection →
        </Link>
      </div>

      {loading ? (
        <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="min-w-[200px] product-card-ref animate-pulse shrink-0">
              <div className="aspect-square bg-hos-bg-tertiary" />
              <div className="p-4 h-24 bg-hos-bg-secondary" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-4">
          {products.map((product) => {
            const p = product as any;
            return (
              <div key={product.id} className="min-w-[200px] max-w-[220px] shrink-0">
                <ProductCard
                  id={product.id}
                  name={product.name}
                  price={product.price}
                  rrp={product.rrp}
                  images={product.images}
                  imageUrl={p.image}
                  averageRating={product.averageRating ?? p.averageRating}
                  vendor={product.seller?.storeName ?? p.vendor}
                  demo={usingDemo}
                />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
