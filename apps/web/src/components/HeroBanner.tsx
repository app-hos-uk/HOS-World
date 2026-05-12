'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

/**
 * Hero Slide Interface
 * 
 * Image Requirements:
 * - Format: JPG or WebP (recommended)
 * - Size: 1920x1080px (16:9 aspect ratio)
 * - Max File Size: 500KB (optimized)
 * - Color Profile: sRGB
 * - Style: High quality, optimized for web
 */
interface HeroSlide {
  id: number;
  title: string;
  subtitle: string;
  description?: string;
  image: string; // Path to image: /hero/[name]-banner.jpg (1920x1080px)
  link: string;
  buttonText: string;
  fandom?: string;
}

interface HeroBannerProps {
  slides?: HeroSlide[];
  autoPlay?: boolean;
  autoPlayInterval?: number;
  animationType?: 'fade' | 'slide' | 'zoom' | 'parallax';
  showIndicators?: boolean;
  showArrows?: boolean;
}

/**
 * Default Hero Slides
 * 
 * Image Specifications:
 * - All images should be 1920x1080px (16:9 aspect ratio)
 * - Format: JPG or WebP
 * - Max file size: 500KB
 * - Place images in: /public/hero/
 * 
 * See: /public/IMAGE_SPECIFICATIONS.md for detailed requirements
 */
const defaultSlides: HeroSlide[] = [
  {
    id: 1,
    title: 'Welcome to the Magical World',
    subtitle: 'House of Spells',
    description: 'Discover authentic wands, collectibles, and magical items from your favorite fandoms',
    image: '/hero/harry-potter-banner.svg', // Placeholder - replace with JPG (1920x1080px, max 500KB)
    link: '/fandoms/harry-potter',
    buttonText: 'Explore Harry Potter',
    fandom: 'Harry Potter',
  },
  {
    id: 2,
    title: 'Journey to Middle-earth',
    subtitle: 'Lord of the Rings',
    description: 'Authentic replicas and collectibles from the epic fantasy world',
    image: '/hero/lotr-banner.svg', // Placeholder - replace with JPG (1920x1080px, max 500KB)
    link: '/fandoms/lord-of-the-rings',
    buttonText: 'Discover Middle-earth',
    fandom: 'Lord of the Rings',
  },
  {
    id: 3,
    title: 'Enter the Game of Thrones',
    subtitle: 'Westeros Collection',
    description: 'Premium collectibles and merchandise from the Seven Kingdoms',
    image: '/hero/got-banner.svg', // Placeholder - replace with JPG (1920x1080px, max 500KB)
    link: '/fandoms/game-of-thrones',
    buttonText: 'Enter Westeros',
    fandom: 'Game of Thrones',
  },
];

export function HeroBanner({
  slides = defaultSlides,
  autoPlay = true,
  autoPlayInterval = 5000,
  animationType = 'fade',
  showIndicators = true,
  showArrows = true,
}: HeroBannerProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const timeoutIdsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  const schedule = useCallback((fn: () => void, delayMs: number) => {
    const id = setTimeout(() => {
      timeoutIdsRef.current.delete(id);
      fn();
    }, delayMs);
    timeoutIdsRef.current.add(id);
    return id;
  }, []);

  useEffect(
    () => () => {
      timeoutIdsRef.current.forEach(clearTimeout);
      timeoutIdsRef.current.clear();
    },
    [],
  );

  useEffect(() => {
    if (!autoPlay) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => {
        setIsAnimating(true);
        schedule(() => {
          setIsAnimating(false);
        }, 300);
        return (prev + 1) % slides.length;
      });
    }, autoPlayInterval);

    return () => clearInterval(interval);
  }, [autoPlay, autoPlayInterval, slides.length, schedule]);

  const nextSlide = () => {
    setIsAnimating(true);
    setCurrentSlide((prev) => (prev + 1) % slides.length);
    schedule(() => setIsAnimating(false), 300);
  };

  const prevSlide = () => {
    setIsAnimating(true);
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
    schedule(() => setIsAnimating(false), 300);
  };

  const goToSlide = (index: number) => {
    if (index === currentSlide) return;
    setIsAnimating(true);
    schedule(() => {
      setCurrentSlide(index);
      setIsAnimating(false);
    }, 300);
  };

  const getAnimationClass = () => {
    switch (animationType) {
      case 'slide':
        return isAnimating ? 'transform translate-x-full opacity-0' : 'transform translate-x-0 opacity-100';
      case 'zoom':
        return isAnimating ? 'transform scale-110 opacity-0' : 'transform scale-100 opacity-100';
      case 'parallax':
        return 'transform';
      default:
        return isAnimating ? 'opacity-0' : 'opacity-100';
    }
  };

  const currentSlideData = slides[currentSlide];

  return (
    <div className="relative w-full h-[400px] sm:h-[500px] md:h-[600px] lg:h-[700px] overflow-hidden">
      {/* Background Image with Parallax Effect */}
      <div
        className={`absolute inset-0 bg-cover bg-center transition-all duration-1000 ease-in-out ${getAnimationClass()}`}
        style={{
          backgroundImage: `url(${currentSlideData.image})`,
          transform: animationType === 'parallax' ? 'scale(1.1)' : undefined,
        }}
      >
        {/* Magical Gradient Overlay - Purple to Indigo */}
        <div className="absolute inset-0 bg-gradient-to-r from-purple-900/80 via-indigo-900/70 to-purple-900/80" />
        <div className="absolute inset-0 bg-gradient-to-t from-purple-950/90 via-purple-900/60 to-transparent" />
        {/* Subtle gold shimmer */}
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-transparent to-amber-500/10" />
      </div>

      {/* Content — pointer-events: non-interactive layer except CTAs */}
      <div className="relative z-10 h-full flex items-center pointer-events-none">
        <div className="container mx-auto px-4 sm:px-6 md:px-8 pointer-events-none">
          <div className="max-w-2xl pointer-events-auto">
            {/* Fandom Badge - Purple with gold accent */}
            {currentSlideData.fandom && (
              <div className="mb-3 sm:mb-4 inline-block">
                <span className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-purple-700 to-indigo-700 text-white text-xs sm:text-sm font-semibold rounded-full font-primary shadow-lg border border-amber-400/30">
                  {currentSlideData.fandom}
                </span>
              </div>
            )}

            {/* Subtitle - Gold/Amber */}
            <p className="text-amber-400 text-sm sm:text-base md:text-lg lg:text-xl mb-2 font-primary font-medium tracking-wide drop-shadow-lg">
              {currentSlideData.subtitle}
            </p>

            {/* Title - White with purple shadow */}
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-6xl xl:text-7xl font-bold text-white mb-3 sm:mb-4 font-primary leading-tight drop-shadow-2xl" style={{ textShadow: '2px 2px 8px rgba(124, 58, 237, 0.5)' }}>
              {currentSlideData.title}
            </h1>

            {/* Description */}
            {currentSlideData.description && (
              <p className="text-purple-100 text-sm sm:text-base md:text-lg lg:text-xl mb-6 sm:mb-8 font-secondary leading-relaxed max-w-xl drop-shadow-md">
                {currentSlideData.description}
              </p>
            )}

            {/* CTA Button - Purple to Indigo gradient with gold hover */}
            <Link
              href={currentSlideData.link}
              className="inline-block px-5 sm:px-6 md:px-8 py-2.5 sm:py-3 md:py-4 bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-700 hover:from-purple-600 hover:via-indigo-600 hover:to-purple-600 text-white font-semibold rounded-lg transition-all duration-300 transform hover:scale-105 shadow-xl hover:shadow-2xl font-primary text-sm sm:text-base md:text-lg border border-amber-400/30 hover:border-amber-400/50"
              prefetch={true}
            >
              {currentSlideData.buttonText} →
            </Link>
          </div>
        </div>
      </div>

      {/* Navigation */}
      {showArrows && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              prevSlide();
            }}
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-30 pointer-events-auto p-2 sm:p-3 bg-purple-800/80 hover:bg-purple-700/90 backdrop-blur-sm rounded-full text-white transition-all duration-300 hover:scale-110 border border-amber-400/30 shadow-lg"
            aria-label="Previous slide"
          >
            <ChevronLeftIcon className="w-4 h-4 sm:w-6 sm:h-6" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              nextSlide();
            }}
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-30 pointer-events-auto p-2 sm:p-3 bg-purple-800/80 hover:bg-purple-700/90 backdrop-blur-sm rounded-full text-white transition-all duration-300 hover:scale-110 border border-amber-400/30 shadow-lg"
            aria-label="Next slide"
          >
            <ChevronRightIcon className="w-4 h-4 sm:w-6 sm:h-6" />
          </button>
        </>
      )}

      {/* Indicators + scroll hint stacked so they don't overlap */}
      {(showIndicators || showArrows) && (
        <div className="absolute bottom-3 sm:bottom-5 left-0 right-0 z-20 flex flex-col items-center gap-3 pointer-events-none">
          {showIndicators && (
            <div className="flex gap-2 pointer-events-auto">
              {slides.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => goToSlide(index)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    index === currentSlide
                      ? 'w-8 bg-gradient-to-r from-amber-500 to-amber-400 shadow-lg'
                      : 'w-2 bg-purple-300/50 hover:bg-purple-300/70'
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          )}
          <div className="flex flex-col items-center gap-1.5 pointer-events-none" aria-hidden="true">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.18em] text-amber-200/95 drop-shadow-sm">
              Discover more
            </span>
            <div className="animate-bounce w-6 h-10 border-2 border-amber-400/50 rounded-full flex justify-center shrink-0">
              <div className="w-1 h-3 bg-amber-400 rounded-full mt-2 animate-pulse" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

