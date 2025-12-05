'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

/**
 * Banner Interface for Carousel
 * 
 * Image Requirements:
 * - Format: JPG or WebP
 * - Size: 800x600px (4:3 aspect ratio)
 * - Max File Size: 200KB (optimized)
 * - Color Profile: sRGB
 * - Place images in: /public/banners/
 * 
 * See: /public/IMAGE_SPECIFICATIONS.md for detailed requirements
 */
interface Banner {
  id: number;
  title: string;
  image: string; // Path to image: /banners/[name].jpg (800x600px)
  link: string;
  badge?: string;
}

interface BannerCarouselProps {
  banners: Banner[];
  scrollSpeed?: 'slow' | 'medium' | 'fast';
  direction?: 'left' | 'right';
}

export function BannerCarousel({
  banners,
  scrollSpeed = 'medium',
  direction = 'left',
}: BannerCarouselProps) {
  const speedClasses = {
    slow: 'animate-scroll-slow',
    medium: 'animate-scroll-medium',
    fast: 'animate-scroll-fast',
  };

  // Duplicate banners for seamless loop
  const duplicatedBanners = [...banners, ...banners];

  return (
    <div className="relative w-full overflow-hidden bg-gradient-to-r from-purple-950 via-indigo-950 to-purple-950 py-4 border-y border-amber-500/20">
      <div
        className={`flex space-x-4 ${speedClasses[scrollSpeed]}`}
        style={{
          animationDirection: direction === 'right' ? 'reverse' : 'normal',
        }}
      >
        {duplicatedBanners.map((banner, index) => (
          <Link
            key={`${banner.id}-${index}`}
            href={banner.link}
            className="flex-shrink-0 group relative overflow-hidden rounded-lg border-2 border-purple-700/50 hover:border-amber-400/50 transition-all duration-300"
            prefetch={false}
          >
            <div className="relative w-48 h-24 sm:w-64 sm:h-32 md:w-80 md:h-40">
              <img
                src={banner.image}
                alt={banner.title}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
              />
              {/* Purple gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-purple-900/90 via-purple-800/60 to-transparent" />
              {banner.badge && (
                <span className="absolute top-2 left-2 px-3 py-1 bg-gradient-to-r from-purple-700 to-indigo-700 text-white text-xs font-semibold rounded-full font-primary border border-amber-400/30 shadow-lg">
                  {banner.badge}
                </span>
              )}
              <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-3 md:p-4">
                <h3 className="text-white font-semibold text-xs sm:text-sm md:text-base font-primary group-hover:text-amber-300 transition-colors drop-shadow-lg">
                  {banner.title}
                </h3>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

