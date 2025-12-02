'use client';

import { useEffect, useState } from 'react';
import { useTheme } from '@hos-marketplace/theme-system';

interface RecentlyViewedItem {
  id: string;
  name: string;
  image: string;
  price: number;
}

export function RecentlyViewed() {
  const [items, setItems] = useState<RecentlyViewedItem[]>([]);
  const theme = useTheme();

  useEffect(() => {
    // Load recently viewed items from localStorage
    const stored = localStorage.getItem('recentlyViewed');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setItems(parsed);
      } catch (error) {
        console.error('Failed to parse recently viewed items:', error);
      }
    }
  }, []);

  // Hide section if empty (per requirements)
  if (items.length === 0) {
    return null;
  }

  return (
    <section>
      <h2 className="text-3xl font-bold mb-6" style={{ color: theme.colors.text.primary }}>
        Recently Viewed
      </h2>
      
      <div 
        className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-${Math.min(items.length, 5)} gap-4 ${
          items.length <= 5 ? 'justify-center' : ''
        }`}
      >
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
            style={{ backgroundColor: theme.colors.surface }}
          >
            <div className="aspect-square bg-gray-200"></div>
            <div className="p-3">
              <h3 className="font-semibold mb-1" style={{ color: theme.colors.text.primary }}>
                {item.name}
              </h3>
              <p className="text-lg font-bold" style={{ color: theme.colors.accent }}>
                ${item.price.toFixed(2)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}


