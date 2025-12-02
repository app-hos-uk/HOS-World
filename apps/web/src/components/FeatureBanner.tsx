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
}

export function FeatureBanner({
  title,
  description,
  image,
  link,
  buttonText,
  position = 'left',
  variant = 'gradient',
}: FeatureBannerProps) {
  const positionClasses = {
    left: 'text-left',
    right: 'text-right',
    center: 'text-center',
  };

  const variantStyles = {
    gradient: 'bg-gradient-to-r from-purple-900/90 via-indigo-900/80 to-purple-900/90',
    overlay: 'bg-purple-950/70 backdrop-blur-sm',
    split: 'bg-gradient-to-r from-purple-50 to-indigo-50',
  };

  const textColorClass = variant === 'split' ? 'text-purple-900' : 'text-white';
  const descColorClass = variant === 'split' ? 'text-purple-700' : 'text-purple-100';

  return (
    <div className="relative w-full h-[400px] md:h-[500px] overflow-hidden rounded-2xl border-2 border-purple-200/50 hover:border-amber-400/50 transition-all duration-300 shadow-xl hover:shadow-2xl">
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-700 hover:scale-105"
        style={{ backgroundImage: `url(${image})` }}
      >
        <div className={`absolute inset-0 ${variantStyles[variant]}`} />
        {/* Gold shimmer effect */}
        {variant !== 'split' && (
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-transparent to-amber-500/10" />
        )}
      </div>

      {/* Content */}
      <div className={`relative z-10 h-full flex items-center ${positionClasses[position]}`}>
        <div className="container mx-auto px-4 md:px-8">
          <div className={`max-w-2xl ${position === 'center' ? 'mx-auto' : position === 'right' ? 'ml-auto' : ''}`}>
            <h2 className={`text-3xl md:text-5xl font-bold mb-4 font-primary ${textColorClass} drop-shadow-lg`}>
              {title}
            </h2>
            <p className={`${descColorClass} text-lg md:text-xl mb-6 font-secondary leading-relaxed`}>
              {description}
            </p>
            <Link
              href={link}
              className={`inline-block px-6 py-3 bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-700 hover:from-purple-600 hover:via-indigo-600 hover:to-purple-600 text-white font-semibold rounded-lg transition-all duration-300 transform hover:scale-105 font-primary shadow-lg hover:shadow-xl border border-amber-400/30 hover:border-amber-400/50`}
              prefetch={true}
            >
              {buttonText}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

