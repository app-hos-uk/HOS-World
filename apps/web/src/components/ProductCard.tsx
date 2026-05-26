'use client';

import Link from 'next/link';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/hooks/useToast';
import { useState } from 'react';
import { trackAddToCart } from '@/lib/analytics';

interface ProductCardProps {
  id: string;
  name: string;
  price: number;
  rrp?: number;
  images?: Array<{ url: string; alt?: string }>;
  imageUrl?: string;
  averageRating?: number;
  fandom?: string;
  vendor?: string;
  badge?: 'sale' | 'new' | null;
  demo?: boolean;
}

export function ProductCard({
  id,
  name,
  price,
  rrp,
  images,
  imageUrl: imageUrlProp,
  averageRating,
  vendor,
  badge,
  demo = false,
}: ProductCardProps) {
  const { formatPrice, currency } = useCurrency();
  const { addToCart } = useCart();
  const toast = useToast();
  const [adding, setAdding] = useState(false);

  const imageUrl = imageUrlProp || images?.[0]?.url;
  const hasDiscount = rrp && rrp > price;
  const displayBadge = badge || (hasDiscount ? 'sale' : null);
  const productHref = demo ? undefined : `/products/${id}`;

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (demo) {
      toast.info('Sample product — browse live listings to add to basket');
      return;
    }
    if (adding) return;
    setAdding(true);
    try {
      await addToCart(id, 1);
      trackAddToCart({ id, name, price, currency: currency || 'USD' }, 1);
      toast.success('Added to basket');
    } catch {
      toast.error('Could not add to basket');
    } finally {
      setAdding(false);
    }
  };

  const renderStars = (rating: number) => {
    const full = Math.floor(rating);
    const hasHalf = rating % 1 >= 0.5;
    return (
      <span className="stars text-hos-gold text-sm tracking-widest" aria-label={`${rating} out of 5 stars`}>
        {'★'.repeat(full)}
        {hasHalf && <span className="inline-block w-[0.52em] overflow-hidden align-baseline">★</span>}
        {'☆'.repeat(5 - full - (hasHalf ? 1 : 0))}
      </span>
    );
  };

  const ImageBlock = productHref ? (
    <Link href={productHref} className="relative aspect-square flex items-center justify-center p-4 overflow-hidden bg-hos-bg-tertiary border-b border-hos-gold-15 block">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={name}
          className="relative z-0 max-w-[88%] max-h-[88%] w-auto h-auto object-contain object-center group-hover:scale-105 transition-transform duration-300"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-hos-text-muted">
          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      )}

      {displayBadge === 'sale' && (
        <span className="absolute top-3 left-3 z-10 font-ui text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-hos-sale-red text-white">
          Sale
        </span>
      )}
      {displayBadge === 'new' && (
        <span className="absolute top-3 left-3 z-10 font-ui text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-hos-new-green text-white">
          New
        </span>
      )}

      {vendor && (
        <span className="absolute bottom-2 left-2 right-2 z-10 font-ui text-[10px] text-hos-text-muted bg-[rgba(7,7,8,0.75)] px-2.5 py-1.5 rounded-md border border-hos-border truncate">
          Sold by {vendor}
        </span>
      )}
    </Link>
  ) : (
    <div className="relative aspect-square flex items-center justify-center p-4 overflow-hidden bg-hos-bg-tertiary border-b border-hos-gold-15">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={name}
          className="relative z-0 max-w-[88%] max-h-[88%] w-auto h-auto object-contain object-center"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-hos-text-muted">
          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      )}
      {displayBadge === 'sale' && (
        <span className="absolute top-3 left-3 z-10 font-ui text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-hos-sale-red text-white">
          Sale
        </span>
      )}
      {displayBadge === 'new' && (
        <span className="absolute top-3 left-3 z-10 font-ui text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-hos-new-green text-white">
          New
        </span>
      )}
    </div>
  );

  return (
    <article className="product-card-ref group flex flex-col h-full w-full">
      {ImageBlock}

      <div className="p-3.5 flex flex-col flex-1 gap-1.5">
        {productHref ? (
          <Link href={productHref}>
            <h3 className="font-display text-sm text-hos-text-primary leading-snug line-clamp-2 hover:text-hos-gold transition-colors">
              {name}
            </h3>
          </Link>
        ) : (
          <h3 className="font-display text-sm text-hos-text-primary leading-snug line-clamp-2">
            {name}
          </h3>
        )}

        {averageRating != null && averageRating > 0 && renderStars(averageRating)}

        <div className="flex items-baseline gap-2.5 flex-wrap mt-auto pt-1">
          <span className="text-hos-gold font-ui font-bold text-base">
            {formatPrice(price)}
          </span>
          {hasDiscount && (
            <span className="text-hos-text-muted text-xs line-through font-ui">
              {formatPrice(rrp)}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleAddToCart}
          disabled={adding}
          aria-busy={adding}
          className="btn-storefront-primary w-full mt-2 py-2.5 text-[13px] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {adding ? 'Adding...' : 'Add to basket'}
        </button>
      </div>
    </article>
  );
}
