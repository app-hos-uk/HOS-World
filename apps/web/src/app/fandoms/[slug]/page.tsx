'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { ProductCard } from '@/components/ProductCard';
import { apiClient } from '@/lib/api';
import Link from 'next/link';
import { notFound } from 'next/navigation';

interface FandomDetailPageProps {
  params: {
    slug: string;
  };
}

const fandoms: Record<string, { name: string; description: string; slug: string }> = {
  'harry-potter': {
    name: 'Harry Potter',
    description: 'Discover magical items from the wizarding world of Harry Potter',
    slug: 'harry-potter',
  },
  'game-of-thrones': {
    name: 'Game of Thrones',
    description: 'Premium collectibles and merchandise from the Seven Kingdoms',
    slug: 'game-of-thrones',
  },
  'stranger-things': {
    name: 'Stranger Things',
    description: 'Collectibles from the Upside Down and Hawkins, Indiana',
    slug: 'stranger-things',
  },
  'lord-of-the-rings': {
    name: 'Lord of the Rings',
    description: 'Authentic replicas and collectibles from Middle-earth',
    slug: 'lord-of-the-rings',
  },
  hobbit: {
    name: 'The Hobbit',
    description: 'Treasures from the Shire and beyond',
    slug: 'hobbit',
  },
  wednesday: {
    name: 'Wednesday',
    description: 'Dark and delightful merchandise from Nevermore Academy',
    slug: 'wednesday',
  },
  friends: {
    name: 'Friends',
    description: 'Could there BE any more collectibles?',
    slug: 'friends',
  },
  'peaky-blinders': {
    name: 'Peaky Blinders',
    description: 'By order of the Peaky Blinders — premium merchandise',
    slug: 'peaky-blinders',
  },
  'star-wars': {
    name: 'Star Wars',
    description: 'Items from a galaxy far, far away',
    slug: 'star-wars',
  },
  'squid-game': {
    name: 'Squid Game',
    description: 'Collectibles from the deadly games',
    slug: 'squid-game',
  },
  'anime-drama': {
    name: 'Anime & Drama Series',
    description: 'Merchandise from your favourite anime and drama titles',
    slug: 'anime-drama',
  },
  'gothic-collection': {
    name: 'Gothic Collection',
    description: 'Dark aesthetic, Victorian-inspired collectibles and gifts',
    slug: 'gothic-collection',
  },
  marvel: {
    name: 'Marvel',
    description: 'Superhero merchandise and collectibles from the Marvel Universe',
    slug: 'marvel',
  },
  'dc-comics': {
    name: 'DC Comics',
    description: 'Superhero collectibles from the DC Universe',
    slug: 'dc-comics',
  },
};

function FandomProducts({ fandomSlug, fandomName }: { fandomSlug: string; fandomName: string }) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fandomSlug]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const fandomMeta = fandoms[fandomSlug];
      const fandomFilters = [fandomSlug, fandomMeta?.name].filter(Boolean) as string[];

      let items: any[] = [];

      try {
        const response = await apiClient.searchProducts('', {
          fandoms: fandomFilters,
          limit: 12,
          page: 1,
        });
        const data = response?.data as { products?: any[] } | undefined;
        items = Array.isArray(data?.products) ? data.products : [];
      } catch {
        // Fall back to REST products API (slug + display name)
        for (const fandomValue of fandomFilters) {
          const response = await apiClient.getProducts({ fandom: fandomValue, limit: 12 });
          const paginated = response?.data as { data?: any[] } | undefined;
          const batch = Array.isArray(paginated?.data) ? paginated.data : [];
          if (batch.length > 0) {
            items = batch;
            break;
          }
        }
      }

      setProducts(items);
    } catch (err: unknown) {
      console.error('Error fetching products:', err);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center text-hos-text-muted py-12">Loading products...</div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center text-sm sm:text-base text-hos-text-muted py-8 sm:py-12">
        No products found for {fandomName} yet. Check back soon!
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          id={product.id}
          name={product.name}
          price={Number(product.price)}
          rrp={product.rrp ? Number(product.rrp) : undefined}
          images={product.images}
          averageRating={product.averageRating}
          vendor={product.vendor?.businessName || product.vendorName}
          fandom={fandomSlug}
        />
      ))}
    </div>
  );
}

export default function FandomDetailPage({ params }: FandomDetailPageProps) {
  const fandom = fandoms[params.slug];

  if (!fandom) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-hos-bg-secondary">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        {/* Breadcrumb */}
        <nav className="mb-4 sm:mb-6 text-xs sm:text-sm">
          <Link href="/" className="text-hos-gold-hover hover:text-amber-400 font-secondary">
            Home
          </Link>
          <span className="mx-1 sm:mx-2 text-hos-text-muted">/</span>
          <Link href="/fandoms" className="text-hos-gold-hover hover:text-amber-400 font-secondary">
            Fandoms
          </Link>
          <span className="mx-1 sm:mx-2 text-hos-text-muted">/</span>
          <span className="text-hos-text-secondary font-secondary">{fandom.name}</span>
        </nav>

        {/* Fandom Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-3 sm:mb-4 font-primary text-hos-gold">
            {fandom.name}
          </h1>
          <p className="text-base sm:text-lg text-hos-gold-hover font-secondary max-w-3xl">
            {fandom.description}
          </p>
        </div>

        {/* Products Section */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3 sm:gap-0">
            <h2 className="text-xl sm:text-2xl font-bold font-primary text-hos-gold">
              Products from {fandom.name}
            </h2>
            <Link
              href={`/products?fandom=${fandom.slug}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-hos-gold text-[#1a1406] text-sm sm:text-base font-semibold rounded-lg hover:bg-hos-gold-hover transition-colors shadow-sm"
            >
              View All {fandom.name} Products
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
          <FandomProducts fandomSlug={params.slug} fandomName={fandom.name} />

          {/* Bottom CTA */}
          <div className="mt-8 text-center">
            <Link
              href={`/products?fandom=${fandom.slug}`}
              className="inline-flex items-center gap-2 px-8 py-3 bg-hos-bg-secondary border border-hos-border text-hos-text-secondary text-lg font-bold rounded-xl hover:border-hos-gold hover:text-hos-gold transition-all shadow-lg hover:shadow-xl"
            >
              Browse All {fandom.name} Products
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Back to Fandoms */}
        <div className="mt-6 sm:mt-8">
          <Link
            href="/fandoms"
            className="inline-flex items-center text-sm sm:text-base text-hos-gold-hover hover:text-amber-400 font-medium font-secondary transition-colors"
          >
            ← Back to All Fandoms
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}

