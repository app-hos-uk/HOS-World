'use client';

import { useEffect, useMemo, useState } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { ProductCard } from '@/components/ProductCard';
import { ProductGridSkeleton } from '@/components/storefront/ProductGridSkeleton';
import { StorefrontBreadcrumbs } from '@/components/storefront/StorefrontBreadcrumbs';
import { apiClient } from '@/lib/api';
import type { FandomCatalogEntry } from '@/lib/fandomCatalog';
import Image from 'next/image';
import Link from 'next/link';

type SortOption = 'newest' | 'price_asc' | 'price_desc' | 'popular';

function FandomProducts({
  fandomSlug,
  fandomName,
  sortBy,
}: {
  fandomSlug: string;
  fandomName: string;
  sortBy: SortOption;
}) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchProducts() {
      setLoading(true);
      try {
        const fandomFilters = [fandomSlug, fandomName];
        let items: any[] = [];

        try {
          const response = await apiClient.searchProducts('', {
            fandoms: fandomFilters,
            limit: 24,
            page: 1,
            sort: sortBy,
          });
          const data = response?.data as { products?: any[] } | undefined;
          items = Array.isArray(data?.products) ? data.products : [];
        } catch {
          for (const fandomValue of fandomFilters) {
            const response = await apiClient.getProducts({
              fandom: fandomValue,
              limit: 24,
              sortBy,
            } as any);
            const paginated = response?.data as { data?: any[] } | undefined;
            const batch = Array.isArray(paginated?.data) ? paginated.data : [];
            if (batch.length > 0) {
              items = batch;
              break;
            }
          }
        }

        if (!cancelled) setProducts(items);
      } catch {
        if (!cancelled) setProducts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchProducts();
    return () => {
      cancelled = true;
    };
  }, [fandomSlug, fandomName, sortBy]);

  if (loading) return <ProductGridSkeleton count={8} />;

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

export function FandomDetailClient({ fandom }: { fandom: FandomCatalogEntry }) {
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  return (
    <div className="min-h-screen bg-hos-bg-secondary">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        <StorefrontBreadcrumbs
          className="mb-4 sm:mb-6"
          items={[
            { label: 'Shop', href: '/shop' },
            { label: 'Fandoms', href: '/fandoms' },
            { label: fandom.name },
          ]}
        />

        <Link
          href="/fandoms"
          className="inline-flex items-center text-sm text-hos-text-muted hover:text-hos-gold mb-4 transition-colors"
        >
          ← Back to All Fandoms
        </Link>

        <div className="relative mb-8 overflow-hidden rounded-2xl border border-hos-border min-h-[180px] sm:min-h-[220px]">
          {fandom.bannerImage ? (
            <Image
              src={fandom.bannerImage}
              alt=""
              fill
              className="object-cover"
              priority
              sizes="100vw"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-hos-bg-tertiary to-hos-bg-secondary" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/50 to-black/20" />
          <div className="relative z-10 p-6 sm:p-10">
            <h1 className="text-2xl sm:text-4xl font-bold font-display text-hos-gold-hover">{fandom.name}</h1>
            <p className="text-sm sm:text-lg text-hos-text-secondary mt-2 max-w-2xl">{fandom.description}</p>
          </div>
        </div>

        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 className="text-xl sm:text-2xl font-bold text-hos-text-secondary">
            Products from {fandom.name}
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-hos-text-muted font-ui">
              Sort by
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="ml-2 select py-1.5 px-2 text-sm"
              >
                <option value="newest">Newest</option>
                <option value="popular">Popular</option>
                <option value="price_asc">Price: low to high</option>
                <option value="price_desc">Price: high to low</option>
              </select>
            </label>
            <Link
              href={`/products?fandom=${fandom.slug}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-hos-gold text-[#1a1406] text-sm font-semibold rounded-lg hover:bg-hos-gold-hover transition-colors"
            >
              View all in catalog
            </Link>
          </div>
        </div>

        <FandomProducts fandomSlug={fandom.slug} fandomName={fandom.name} sortBy={sortBy} />
      </main>
      <Footer />
    </div>
  );
}
