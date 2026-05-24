'use client';

import { useEffect, useState } from 'react';
import { ProductCard } from '@/components/ProductCard';

interface RecentlyViewedItem {
  id: string;
  name: string;
  image: string;
  price: number;
  rrp?: number;
  averageRating?: number;
  vendor?: string;
}

export function RecentlyViewed() {
  const [items, setItems] = useState<RecentlyViewedItem[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('recentlyViewed');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setItems(Array.isArray(parsed) ? parsed : []);
      } catch (error) {
        console.error('Failed to parse recently viewed items:', error);
      }
    }
  }, []);

  if (items.length === 0) {
    return null;
  }

  const getGridCols = () => {
    if (items.length === 1) return 'grid-cols-1 max-w-xs mx-auto';
    if (items.length === 2) return 'grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto';
    if (items.length <= 4) return 'grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4';
    return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5';
  };

  return (
    <section>
      <h2 className="font-display text-white text-2xl md:text-3xl font-bold mb-6">
        Recently Viewed
      </h2>

      <div className={`grid ${getGridCols()} gap-4 sm:gap-6`}>
        {items.map((item) => (
          <ProductCard
            key={item.id}
            id={item.id}
            name={item.name}
            price={item.price}
            rrp={item.rrp}
            images={item.image ? [{ url: item.image, alt: item.name }] : undefined}
            averageRating={item.averageRating}
            vendor={item.vendor}
          />
        ))}
      </div>
    </section>
  );
}
