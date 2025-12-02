'use client';

import Link from 'next/link';
import { useTheme } from '@hos-marketplace/theme-system';

const fandoms = [
  { id: 1, name: 'Harry Potter', slug: 'harry-potter', image: '/placeholder-fandom.jpg' },
  { id: 2, name: 'Lord of the Rings', slug: 'lord-of-the-rings', image: '/placeholder-fandom.jpg' },
  { id: 3, name: 'Game of Thrones', slug: 'game-of-thrones', image: '/placeholder-fandom.jpg' },
  { id: 4, name: 'Marvel', slug: 'marvel', image: '/placeholder-fandom.jpg' },
  { id: 5, name: 'Star Wars', slug: 'star-wars', image: '/placeholder-fandom.jpg' },
  { id: 6, name: 'DC Comics', slug: 'dc-comics', image: '/placeholder-fandom.jpg' },
];

export function FandomCollection() {
  const theme = useTheme();

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold" style={{ color: theme.colors.text.primary }}>
          Fandom Collection
        </h2>
        <Link
          href="/fandoms"
          className="text-accent hover:underline font-medium"
          style={{ color: theme.colors.accent }}
        >
          See more
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {fandoms.map((fandom) => (
          <Link
            key={fandom.id}
            href={`/fandoms/${fandom.slug}`}
            className="block rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
            style={{ backgroundColor: theme.colors.surface }}
            prefetch={true}
          >
            <div className="aspect-square bg-gray-200"></div>
            <div className="p-3">
              <h3 className="font-semibold text-center" style={{ color: theme.colors.text.primary }}>
                {fandom.name}
              </h3>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}


