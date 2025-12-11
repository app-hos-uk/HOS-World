'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { apiClient } from '@/lib/api';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProductCard } from '@/components/ProductCard';

interface FandomDetailPageProps {
  params: {
    slug: string;
  };
}

// Fandom data - in production, this would come from an API
const fandoms: Record<string, { name: string; description: string; slug: string }> = {
  'harry-potter': {
    name: 'Harry Potter',
    description: 'Discover magical items from the wizarding world of Harry Potter',
    slug: 'harry-potter',
  },
  'lord-of-the-rings': {
    name: 'Lord of the Rings',
    description: 'Authentic replicas and collectibles from Middle-earth',
    slug: 'lord-of-the-rings',
  },
  'game-of-thrones': {
    name: 'Game of Thrones',
    description: 'Premium collectibles and merchandise from the Seven Kingdoms',
    slug: 'game-of-thrones',
  },
  'marvel': {
    name: 'Marvel',
    description: 'Superhero merchandise and collectibles from the Marvel Universe',
    slug: 'marvel',
  },
  'star-wars': {
    name: 'Star Wars',
    description: 'Items from a galaxy far, far away',
    slug: 'star-wars',
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
      const response = await apiClient.getProducts({ fandom: fandomSlug, limit: 12 });
      if (response?.data) {
        setProducts((response.data as any).items || (response.data as any).data || []);
      }
    } catch (err: any) {
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center text-gray-500 py-12">Loading products...</div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center text-sm sm:text-base text-gray-500 py-8 sm:py-12">
        No products found for {fandomName}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
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
    <div className="min-h-screen bg-white">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        {/* Breadcrumb */}
        <nav className="mb-4 sm:mb-6 text-xs sm:text-sm">
          <Link href="/" className="text-purple-700 hover:text-amber-600 font-secondary">
            Home
          </Link>
          <span className="mx-1 sm:mx-2 text-gray-500">/</span>
          <Link href="/fandoms" className="text-purple-700 hover:text-amber-600 font-secondary">
            Fandoms
          </Link>
          <span className="mx-1 sm:mx-2 text-gray-500">/</span>
          <span className="text-gray-600 font-secondary">{fandom.name}</span>
        </nav>

        {/* Fandom Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-3 sm:mb-4 font-primary text-purple-900">
            {fandom.name}
          </h1>
          <p className="text-base sm:text-lg text-purple-700 font-secondary max-w-3xl">
            {fandom.description}
          </p>
        </div>

        {/* Products Section */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3 sm:gap-0">
            <h2 className="text-xl sm:text-2xl font-bold font-primary text-purple-900">
              Products from {fandom.name}
            </h2>
            <Link
              href={`/products?fandom=${fandom.slug}`}
              className="text-sm sm:text-base text-purple-700 hover:text-amber-600 font-medium font-secondary transition-colors"
            >
              View All →
            </Link>
          </div>
          <FandomProducts fandomSlug={params.slug} fandomName={fandom.name} />
        </div>

        {/* Back to Fandoms */}
        <div className="mt-6 sm:mt-8">
          <Link
            href="/fandoms"
            className="inline-flex items-center text-sm sm:text-base text-purple-700 hover:text-amber-600 font-medium font-secondary transition-colors"
          >
            ← Back to All Fandoms
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}

