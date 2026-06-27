'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useSiteSettings } from '@/contexts/SiteSettingsContext';
import { brandDisplayName } from '@/lib/siteSettingsDefaults';
import { BRAND_LOGOS } from '@/lib/referenceAssets';

export type BrandLogoVariant = 'horizontal' | 'stacked' | 'emblem';

type BrandLogoProps = {
  variant?: BrandLogoVariant;
  /** Wrap logo in a link (default: /shop) */
  linked?: boolean;
  href?: string;
  priority?: boolean;
  className?: string;
};

const VARIANT_SIZES: Record<
  BrandLogoVariant,
  { width: number; height: number; className: string; emblem?: { w: number; h: number; class: string }; wordmark?: { w: number; h: number; class: string } }
> = {
  horizontal: {
    width: 280,
    height: 64,
    className: 'flex items-center gap-3',
    emblem: { w: 56, h: 56, class: 'h-12 w-12 sm:h-14 sm:w-14 object-contain shrink-0' },
    wordmark: { w: 220, h: 56, class: 'h-8 sm:h-10 w-auto max-w-[200px] sm:max-w-[240px] object-contain object-left' },
  },
  stacked: {
    width: 200,
    height: 200,
    className: 'inline-block',
  },
  emblem: {
    width: 56,
    height: 56,
    className: 'inline-block',
  },
};

export function BrandLogo({
  variant = 'horizontal',
  linked = false,
  href = '/shop',
  priority = false,
  className = '',
}: BrandLogoProps) {
  const site = useSiteSettings();
  const altText = brandDisplayName(site.platformName);
  const sizes = VARIANT_SIZES[variant];

  const content =
    variant === 'horizontal' ? (
      <span className={`${sizes.className} ${className}`}>
        <Image
          src={BRAND_LOGOS.emblem}
          alt=""
          aria-hidden
          width={sizes.emblem!.w}
          height={sizes.emblem!.h}
          className={sizes.emblem!.class}
          priority={priority}
        />
        <Image
          src={BRAND_LOGOS.wordmark}
          alt={altText}
          width={sizes.wordmark!.w}
          height={sizes.wordmark!.h}
          className={sizes.wordmark!.class}
          priority={priority}
        />
      </span>
    ) : (
      <Image
        src={variant === 'stacked' ? BRAND_LOGOS.stacked : BRAND_LOGOS.emblem}
        alt="House of Spells"
        width={sizes.width}
        height={sizes.height}
        className={
          variant === 'stacked'
            ? (className || 'h-20 sm:h-24 w-auto object-contain')
            : `h-12 w-12 object-contain ${className}`
        }
        priority={priority}
      />
    );

  if (linked) {
    return (
      <Link href={href} className="inline-flex shrink-0 group">
        {content}
      </Link>
    );
  }

  return content;
}
