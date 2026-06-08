'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { SafeImage } from '@/components/SafeImage';
import { apiClient } from '@/lib/api';
import { getPublicApiBaseUrl } from '@/lib/apiBaseUrl';
import { REFERENCE_ASSETS, REFERENCE_FRANCHISE_ORDER } from '@/lib/referenceAssets';

interface FandomCollectionProps {
  limit?: number;
  showAllPage?: boolean;
}

interface FandomItem {
  id: string;
  slug: string;
  name: string;
  image?: string;
  logo?: string;
  photo?: boolean;
  hasProducts?: boolean;
}

function resolveImageUrl(src: string | null | undefined): string {
  if (!src || typeof src !== 'string') return '';
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('//')) return src;
  const base = getPublicApiBaseUrl();
  const origin = base.replace(/\/api\/?$/, '');
  return origin + (src.startsWith('/') ? src : `/${src}`);
}

function getReferenceFandoms(limit?: number): FandomItem[] {
  const items = REFERENCE_FRANCHISE_ORDER.map((key) => {
    const ref = REFERENCE_ASSETS.franchises[key];
    return {
      id: key,
      slug: key,
      name: ref.name,
      logo: ref.logo,
      photo: 'photo' in ref ? ref.photo : false,
    };
  });
  return limit != null ? items.slice(0, limit) : items;
}

export function FandomCollection({ limit, showAllPage = false }: FandomCollectionProps) {
  const [fandoms, setFandoms] = useState<FandomItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingReference, setUsingReference] = useState(false);

  useEffect(() => {
    fetchFandoms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchFandoms = async () => {
    try {
      const response = await apiClient.getFandoms();
      const list = response?.data;
      const arr = Array.isArray(list) ? list : [];

      if (arr.length > 0) {
        const mapped: FandomItem[] = arr.map((f: any) => {
          const slug = f.slug || f.id;
          const ref = REFERENCE_ASSETS.franchises[slug as keyof typeof REFERENCE_ASSETS.franchises];
          return {
            id: f.id ?? slug,
            slug,
            name: f.name,
            image: resolveImageUrl(f.image),
            logo: ref?.logo,
            photo: ref && 'photo' in ref ? ref.photo : false,
          };
        });
        setFandoms(limit != null ? mapped.slice(0, limit) : mapped);
        setUsingReference(false);
      } else {
        setFandoms(getReferenceFandoms(limit));
        setUsingReference(true);
      }
    } catch {
      setFandoms(getReferenceFandoms(limit));
      setUsingReference(true);
    } finally {
      setLoading(false);
    }
  };

  const skeletonCount = showAllPage ? 12 : 8;
  const gridClass = showAllPage
    ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5'
    : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5';

  return (
    <section className={showAllPage ? undefined : 'max-w-7xl mx-auto px-4 py-12'}>
      {!showAllPage && (
        <div className="flex items-end justify-between mb-8 gap-4 section-head">
          <div>
            <h2 className="font-display text-hos-gold-hover text-2xl md:text-3xl">
              Shop by franchise
            </h2>
            <p className="text-hos-text-muted text-sm mt-1 font-body">
              The magic is within you — explore our top worlds.
            </p>
          </div>
          <Link
            href="/fandoms"
            className="text-hos-gold text-sm font-ui font-semibold hover:text-hos-gold-hover transition-colors shrink-0"
            prefetch={true}
          >
            View all franchises →
          </Link>
        </div>
      )}

      {loading ? (
        <div className={gridClass}>
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <div key={`skeleton-${i}`} className="aspect-square rounded-full bg-hos-bg-secondary border border-hos-border animate-pulse" />
          ))}
        </div>
      ) : (
        <div className={gridClass}>
          {fandoms.map((fandom) => {
            const logoSrc = fandom.logo || fandom.image;
            const fandomHref = fandom.hasProducts === false
              ? `/coming-soon?franchise=${encodeURIComponent(fandom.name)}`
              : `/fandoms/${fandom.slug}`;
            return (
              <Link
                key={fandom.id}
                href={fandomHref}
                className="cat-card group"
                prefetch={true}
              >
                <span className="cat-logo-slot">
                  {logoSrc ? (
                    <Image
                      src={logoSrc}
                      alt={fandom.name}
                      width={200}
                      height={200}
                      className="w-full h-full object-contain object-center"
                    />
                  ) : fandom.image ? (
                    <SafeImage
                      src={fandom.image}
                      alt={fandom.name}
                      width={200}
                      height={200}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <span className="text-2xl text-hos-text-muted font-bold">{fandom.name.charAt(0)}</span>
                  )}
                </span>
                <span className="relative font-ui text-xs sm:text-sm font-semibold text-hos-text-primary text-center leading-tight">
                  {fandom.name}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {usingReference && !loading && !showAllPage && (
        <p className="sr-only">Showing reference franchise logos</p>
      )}
    </section>
  );
}
