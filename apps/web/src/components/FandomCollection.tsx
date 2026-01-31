'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTheme } from '@hos-marketplace/theme-system';
import { apiClient } from '@/lib/api';

interface FandomCollectionProps {
  /** Max number to show; undefined = show all (e.g. on /fandoms page). Use 6 for homepage. */
  limit?: number;
  /** When true, hide "See more" and use full-width layout (for /fandoms page). */
  showAllPage?: boolean;
}

export function FandomCollection({ limit, showAllPage = false }: FandomCollectionProps) {
  const theme = useTheme();
  const [fandoms, setFandoms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFandoms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchFandoms = async () => {
    try {
      setError(null);
      const response = await apiClient.getFandoms();
      const list = response?.data;
      const arr = Array.isArray(list) ? list : [];
      setFandoms(limit != null ? arr.slice(0, limit) : arr);
    } catch (err: any) {
      console.error('Error fetching fandoms:', err);
      setError(err.message || 'Failed to load fandoms');
      setFandoms([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      {!showAllPage && (
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
      )}

      {loading ? (
        <div className="text-center text-gray-500 py-8">Loading fandoms...</div>
      ) : error ? (
        <div className="text-center py-8">
          <p className="text-gray-600 mb-4">{error}</p>
          <Link href="/products" className="text-purple-600 hover:underline font-medium">Browse products</Link>
        </div>
      ) : fandoms.length === 0 ? (
        <div className="text-center py-10 px-4 rounded-lg bg-gray-50">
          <p className="text-gray-600 mb-2">No fandoms available yet.</p>
          <p className="text-sm text-gray-500 mb-4">Create fandoms in Admin → Products → Fandoms, or explore our products.</p>
          <Link href="/products" className="inline-block px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium">
            Browse products
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
          {fandoms.map((fandom) => (
            <Link
              key={fandom.id ?? fandom.slug}
              href={`/fandoms/${fandom.slug}`}
              className="block rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
              style={{ backgroundColor: theme.colors.surface }}
              prefetch={true}
            >
              <div className="relative aspect-square bg-gray-200 flex items-center justify-center overflow-hidden">
                {fandom.image ? (
                  <Image src={fandom.image} alt="" fill className="object-cover" sizes="(max-width: 768px) 50vw, 16vw" />
                ) : null}
              </div>
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


