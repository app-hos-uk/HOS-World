'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTheme } from '@hos-marketplace/theme-system';
import { apiClient } from '@/lib/api';

export function FandomCollection() {
  const theme = useTheme();
  const [fandoms, setFandoms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFandoms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchFandoms = async () => {
    try {
      const response = await apiClient.getFandoms();
      if (response?.data && Array.isArray(response.data)) {
        setFandoms(response.data.slice(0, 6)); // Show first 6 fandoms
      } else {
        // Fallback to hardcoded fandoms if API fails
        setFandoms([
          { id: 1, name: 'Harry Potter', slug: 'harry-potter', image: '/placeholder-fandom.jpg' },
          { id: 2, name: 'Lord of the Rings', slug: 'lord-of-the-rings', image: '/placeholder-fandom.jpg' },
          { id: 3, name: 'Game of Thrones', slug: 'game-of-thrones', image: '/placeholder-fandom.jpg' },
          { id: 4, name: 'Marvel', slug: 'marvel', image: '/placeholder-fandom.jpg' },
          { id: 5, name: 'Star Wars', slug: 'star-wars', image: '/placeholder-fandom.jpg' },
          { id: 6, name: 'DC Comics', slug: 'dc-comics', image: '/placeholder-fandom.jpg' },
        ]);
      }
    } catch (err: any) {
      console.error('Error fetching fandoms:', err);
      // Fallback to hardcoded fandoms
      setFandoms([
        { id: 1, name: 'Harry Potter', slug: 'harry-potter', image: '/placeholder-fandom.jpg' },
        { id: 2, name: 'Lord of the Rings', slug: 'lord-of-the-rings', image: '/placeholder-fandom.jpg' },
        { id: 3, name: 'Game of Thrones', slug: 'game-of-thrones', image: '/placeholder-fandom.jpg' },
        { id: 4, name: 'Marvel', slug: 'marvel', image: '/placeholder-fandom.jpg' },
        { id: 5, name: 'Star Wars', slug: 'star-wars', image: '/placeholder-fandom.jpg' },
        { id: 6, name: 'DC Comics', slug: 'dc-comics', image: '/placeholder-fandom.jpg' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3 sm:gap-0">
        <h2 className="text-2xl sm:text-3xl font-bold" style={{ color: theme.colors.text.primary }}>
          Fandom Collection
        </h2>
        <Link
          href="/fandoms"
          className="text-sm sm:text-base text-accent hover:underline font-medium"
          style={{ color: theme.colors.accent }}
        >
          See more
        </Link>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-8">Loading fandoms...</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
          {fandoms.map((fandom) => (
          <Link
            key={fandom.id}
            href={`/fandoms/${fandom.slug}`}
            className="block rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
            style={{ backgroundColor: theme.colors.surface }}
            prefetch={true}
          >
            <div className="aspect-square bg-gray-200"></div>
            <div className="p-2 sm:p-3">
              <h3 className="font-semibold text-center text-xs sm:text-sm" style={{ color: theme.colors.text.primary }}>
                {fandom.name}
              </h3>
            </div>
          </Link>
          ))}
        </div>
      )}
    </section>
  );
}


