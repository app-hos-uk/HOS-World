'use client';

import Link from 'next/link';

/**
 * Feature Banner Props
 * 
 * Image Requirements:
 * - Format: JPG or WebP
 * - Size: 1920x1080px (16:9 aspect ratio)
 * - Max File Size: 400KB (optimized)
 * - Color Profile: sRGB
 * - Place images in: /public/featured/
 * 
 * See: /public/IMAGE_SPECIFICATIONS.md for detailed requirements
 */
interface FeatureBannerProps {
  title: string;
  description: string;
  image: string; // Path to image: /featured/[name].jpg (1920x1080px)
  link: string;
  buttonText: string;
  position?: 'left' | 'right' | 'center';
  variant?: 'gradient' | 'overlay' | 'split';
  categoryTag?: string;
}

export function FeatureBanner({
  title,
  description,
  image,
  link,
  buttonText,
  position = 'left',
  variant = 'gradient',
  categoryTag,
}: FeatureBannerProps) {
  const positionClasses = {
    left: 'text-left',
    right: 'text-right',
    center: 'text-center',
  };

  const overlayClasses = {
    gradient: 'bg-gradient-to-r from-black/85 via-black/65 to-black/75',
    overlay: 'bg-black/75',
    split: 'bg-black/80',
  };

  const displayCategory =
    categoryTag ??
    (title.toLowerCase().includes('apparel') ? 'Apparel & robes' : 'Collectibles');

  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl border border-hos-border bg-hos-bg-secondary p-7 hover:border-hos-border-accent transition-colors duration-200 ${positionClasses[position]}`}
    >
      {/* Background Image with dark overlay */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-40"
        style={{ backgroundImage: `url(${image})` }}
        aria-hidden
      >
        <div className={`absolute inset-0 ${overlayClasses[variant]}`} />
      </div>

      {/* Content */}
      <div className={`relative z-10 ${position === 'center' ? 'mx-auto max-w-lg' : 'max-w-md'} ${position === 'right' ? 'ml-auto' : ''}`}>
        <p className="text-hos-gold text-[11px] uppercase tracking-wider font-semibold font-ui">
          {displayCategory}
        </p>
        <h2 className="text-hos-text-secondary text-lg font-bold font-ui mt-2">
          {title}
        </h2>
        <p className="text-hos-text-secondary text-sm mt-2 leading-relaxed">
          {description}
        </p>
        <Link
          href={link}
          className="text-hos-gold text-sm hover:text-hos-gold-hover mt-4 inline-block transition-colors duration-200"
          prefetch={true}
        >
          {buttonText} →
        </Link>
      </div>
    </div>
  );
}
