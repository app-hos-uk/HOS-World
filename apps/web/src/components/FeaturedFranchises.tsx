'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { apiClient } from '@/lib/api';
import { REFERENCE_ASSETS } from '@/lib/referenceAssets';

type FranchiseCard = {
  name: string;
  slug: string;
  description: string;
  image: string;
};

const STATIC_FRANCHISES: FranchiseCard[] = [
  {
    name: 'Harry Potter',
    slug: 'harry-potter',
    description: 'Where the ordinary meets the extraordinary — wands, robes, and collectables.',
    image: REFERENCE_ASSETS.franchiseBanners['harry-potter'],
  },
  {
    name: 'Lord of the Rings',
    slug: 'lord-of-the-rings',
    description: 'One ring to rule them all — jewelry, art, and Middle‑earth homeware.',
    image: REFERENCE_ASSETS.franchiseBanners['lord-of-the-rings'],
  },
  {
    name: 'Game of Thrones',
    slug: 'game-of-thrones',
    description: 'Claim your throne — house sigils, glassware, and gifts fit for a monarch.',
    image: REFERENCE_ASSETS.franchiseBanners['game-of-thrones'],
  },
];

export default function FeaturedFranchises() {
  const [franchises, setFranchises] = useState<FranchiseCard[]>(STATIC_FRANCHISES);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.getFandoms();
        const list = res?.data as Array<{
          name: string;
          slug: string;
          description?: string;
          image?: string;
        }>;
        if (!Array.isArray(list) || list.length === 0 || cancelled) return;
        setFranchises(
          list.slice(0, 3).map((f) => ({
            name: f.name,
            slug: f.slug,
            description: f.description || 'Explore collectibles and merch from this universe.',
            image:
              f.image ||
              REFERENCE_ASSETS.franchiseBanners[f.slug as keyof typeof REFERENCE_ASSETS.franchiseBanners] ||
              REFERENCE_ASSETS.heroBanner,
          })),
        );
      } catch {
        // keep static fallback
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="max-w-7xl mx-auto px-4 py-12">
      <div className="mb-8 section-head">
        <h2 className="font-display text-hos-gold-hover text-2xl md:text-3xl">
          Featured franchises
        </h2>
        <p className="text-hos-text-muted text-sm mt-1 font-body">
          Hero collections across our biggest worlds — pair these strips with the franchise ring up the page.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {franchises.map((franchise) => (
          <Link
            key={franchise.slug}
            href={`/fandoms/${franchise.slug}`}
            className="group relative overflow-hidden rounded-[10px] border border-hos-border h-64 flex items-end hover:border-hos-border-accent transition-all duration-200"
          >
            <Image
              src={franchise.image}
              alt={franchise.name}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, 33vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/20" />

            <div className="relative z-10 p-6 w-full">
              <h3 className="font-display text-hos-gold-hover text-lg">
                {franchise.name}
              </h3>
              <p className="text-hos-text-muted text-sm mt-1 line-clamp-2 font-body">
                {franchise.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}