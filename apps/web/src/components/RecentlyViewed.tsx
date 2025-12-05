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

  // Determine grid columns based on item count
  const getGridCols = () => {
    if (items.length === 1) return 'grid-cols-1 max-w-xs mx-auto';
    if (items.length === 2) return 'grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto';
    if (items.length <= 4) return 'grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4';
    return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5';
  };

  return (
    <section>
      <h2 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6" style={{ color: theme.colors.text.primary }}>
        Recently Viewed
      </h2>
      
      <div className={`grid ${getGridCols()} gap-3 sm:gap-4`}>
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
            style={{ backgroundColor: theme.colors.surface }}
          >
            <div className="aspect-square bg-gray-200"></div>
            <div className="p-2 sm:p-3">
              <h3 className="font-semibold mb-1 text-sm sm:text-base" style={{ color: theme.colors.text.primary }}>
                {item.name}
              </h3>
              <p className="text-base sm:text-lg font-bold" style={{ color: theme.colors.accent }}>
                ${item.price.toFixed(2)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}


