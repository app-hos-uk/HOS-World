'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { REFERENCE_ASSETS } from '@/lib/referenceAssets';

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

const HERO_FALLBACK_IMAGE = REFERENCE_ASSETS.heroBanner;

const TRUST_STRIP_ITEMS = [
  {
    title: 'Buyer protection',
    description: 'Dispute support on marketplace orders',
  },
  {
    title: 'Fast US delivery',
    description: 'Tracked shipping · Click & collect near our stores',
  },
  {
    title: 'Official & fan-favorite lines',
    description: 'From wands and jewelry to limited prints',
  },
];

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
    image: HERO_FALLBACK_IMAGE,
    link: '/fandoms/harry-potter',
    buttonText: 'Explore Harry Potter',
    fandom: 'Harry Potter',
  },
  {
    id: 2,
    title: 'Journey to Middle-earth',
    subtitle: 'Lord of the Rings',
    description: 'Authentic replicas and collectibles from the epic fantasy world',
    image: HERO_FALLBACK_IMAGE,
    link: '/fandoms/lord-of-the-rings',
    buttonText: 'Discover Middle-earth',
    fandom: 'Lord of the Rings',
  },
  {
    id: 3,
    title: 'Enter the Game of Thrones',
    subtitle: 'Westeros Collection',
    description: 'Premium collectibles and merchandise from the Seven Kingdoms',
    image: HERO_FALLBACK_IMAGE,
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
  const heroBackgroundImage = currentSlideData.image || HERO_FALLBACK_IMAGE;

  return (
    <>
      <div className="relative w-full min-h-[420px] mx-4 my-6 max-w-7xl lg:mx-auto flex items-center overflow-hidden rounded-2xl border border-hos-border">
        {/* Background Image */}
        <div
          className={`absolute inset-0 bg-cover bg-no-repeat transition-all duration-1000 ease-in-out ${getAnimationClass()}`}
          style={{
            backgroundImage: `linear-gradient(120deg, rgba(7, 7, 8, 0.88) 0%, rgba(7, 7, 8, 0.48) 42%, rgba(7, 7, 8, 0.93) 100%), url(${heroBackgroundImage})`,
            backgroundPosition: 'center 40%',
          }}
        />

        {/* Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 py-12 sm:py-16 w-full pointer-events-none">
          <div className="max-w-xl pointer-events-auto">
            <p className="text-hos-gold text-xs tracking-[0.2em] uppercase font-ui font-semibold mb-3">
              Fandom retail · Multi-vendor marketplace
            </p>

            <h1 className="font-display text-hos-gold-hover text-4xl md:text-5xl leading-tight mb-4 drop-shadow-[0_2px_24px_rgba(0,0,0,0.6)]">
              Step inside the magic
            </h1>

            <p className="text-hos-text-muted text-lg leading-relaxed mb-7 max-w-md font-body">
              Collectibles, replicas, apparel, and curios from the worlds you love — curated from official lines and trusted sellers, in one enchanted storefront.
            </p>

            <div className="flex flex-row flex-wrap gap-3">
              <Link href="/products" className="btn-storefront-primary" prefetch={true}>
                Shop trending deals
              </Link>
              <Link href="/fandoms" className="btn-storefront-ghost" prefetch={true}>
                Browse franchises
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
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-30 pointer-events-auto p-2 sm:p-3 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-full text-hos-gold transition-all duration-300 hover:scale-110 border border-hos-border shadow-lg"
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
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-30 pointer-events-auto p-2 sm:p-3 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-full text-hos-gold transition-all duration-300 hover:scale-110 border border-hos-border shadow-lg"
              aria-label="Next slide"
            >
              <ChevronRightIcon className="w-4 h-4 sm:w-6 sm:h-6" />
            </button>
          </>
        )}

        {/* Indicators */}
        {showIndicators && (
          <div className="absolute bottom-5 left-0 right-0 z-20 flex justify-center pointer-events-none">
            <div className="flex gap-2 pointer-events-auto">
              {slides.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => goToSlide(index)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    index === currentSlide
                      ? 'w-8 bg-hos-gold shadow-lg'
                      : 'w-2 bg-hos-bg-secondary/30 hover:bg-hos-bg-secondary/50'
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Trust strip */}
      <div className="bg-hos-bg-secondary py-5 border-y border-hos-border">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-6 md:divide-x divide-y md:divide-y-0 divide-hos-border">
          {TRUST_STRIP_ITEMS.map((item) => (
            <div key={item.title} className="flex items-start gap-3 px-4 py-2 md:py-0 md:justify-center">
              <div className="text-hos-gold shrink-0 mt-0.5" aria-hidden>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <div>
                <p className="text-hos-text-primary text-sm font-ui font-semibold">{item.title}</p>
                <p className="text-hos-text-muted text-xs mt-0.5 font-body">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

