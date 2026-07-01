import Link from 'next/link';
import { BrandLogo } from '@/components/BrandLogo';

interface MinimalCheckoutHeaderProps {
  backHref?: string;
  backLabel?: string;
}

/** Reduced chrome for cart/checkout — logo + back link only */
export function MinimalCheckoutHeader({
  backHref = '/shop',
  backLabel = 'Continue shopping',
}: MinimalCheckoutHeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-hos-border bg-hos-bg/95 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <BrandLogo variant="horizontal" linked href="/shop" />
        <Link
          href={backHref}
          className="text-sm font-ui text-hos-text-muted hover:text-hos-gold transition-colors whitespace-nowrap"
        >
          ← {backLabel}
        </Link>
      </div>
    </header>
  );
}
