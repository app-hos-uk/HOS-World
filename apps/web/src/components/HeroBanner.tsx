'use client';

import { useState, useEffect } from 'react';
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
    image: '/hero/harry-potter-banner.jpg', // 1920x1080px, max 500KB
    link: '/fandoms/harry-potter',
    buttonText: 'Explore Harry Potter',
    fandom: 'Harry Potter',
  },
  {
    id: 2,
    title: 'Journey to Middle-earth',
    subtitle: 'Lord of the Rings',
    description: 'Authentic replicas and collectibles from the epic fantasy world',
    image: '/hero/lotr-banner.jpg', // 1920x1080px, max 500KB
    link: '/fandoms/lord-of-the-rings',
    buttonText: 'Discover Middle-earth',
    fandom: 'Lord of the Rings',
  },
  {
    id: 3,
    title: 'Enter the Game of Thrones',
    subtitle: 'Westeros Collection',
    description: 'Premium collectibles and merchandise from the Seven Kingdoms',
    image: '/hero/got-banner.jpg', // 1920x1080px, max 500KB
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

  useEffect(() => {
    if (!autoPlay) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => {
        setIsAnimating(true);
        setTimeout(() => {
          setIsAnimating(false);
        }, 300);
        return (prev + 1) % slides.length;
      });
    }, autoPlayInterval);

    return () => clearInterval(interval);
  }, [autoPlay, autoPlayInterval, slides.length]);

  const nextSlide = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
      setIsAnimating(false);
    }, 300);
  };

  const prevSlide = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
      setIsAnimating(false);
    }, 300);
  };

  const goToSlide = (index: number) => {
    if (index === currentSlide) return;
    setIsAnimating(true);
    setTimeout(() => {
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
    <div className="relative w-full h-[600px] md:h-[700px] overflow-hidden">
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

      {/* Content */}
      <div className="relative z-10 h-full flex items-center">
        <div className="container mx-auto px-4 md:px-8">
          <div className="max-w-2xl">
            {/* Fandom Badge - Purple with gold accent */}
            {currentSlideData.fandom && (
              <div className="mb-4 inline-block">
                <span className="px-4 py-2 bg-gradient-to-r from-purple-700 to-indigo-700 text-white text-sm font-semibold rounded-full font-primary shadow-lg border border-amber-400/30">
                  {currentSlideData.fandom}
                </span>
              </div>
            )}

            {/* Subtitle - Gold/Amber */}
            <p className="text-amber-400 text-lg md:text-xl mb-2 font-primary font-medium tracking-wide drop-shadow-lg">
              {currentSlideData.subtitle}
            </p>

            {/* Title - White with purple shadow */}
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-4 font-primary leading-tight drop-shadow-2xl" style={{ textShadow: '2px 2px 8px rgba(124, 58, 237, 0.5)' }}>
              {currentSlideData.title}
            </h1>

            {/* Description */}
            {currentSlideData.description && (
              <p className="text-purple-100 text-lg md:text-xl mb-8 font-secondary leading-relaxed max-w-xl drop-shadow-md">
                {currentSlideData.description}
              </p>
            )}

            {/* CTA Button - Purple to Indigo gradient with gold hover */}
            <Link
              href={currentSlideData.link}
              className="inline-block px-8 py-4 bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-700 hover:from-purple-600 hover:via-indigo-600 hover:to-purple-600 text-white font-semibold rounded-lg transition-all duration-300 transform hover:scale-105 shadow-xl hover:shadow-2xl font-primary text-lg border border-amber-400/30 hover:border-amber-400/50"
              prefetch={true}
            >
              {currentSlideData.buttonText} →
            </Link>
          </div>
        </div>
      </div>

      {/* Navigation Arrows - Purple with gold accent */}
      {showArrows && (
        <>
          <button
            onClick={prevSlide}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-3 bg-purple-800/80 hover:bg-purple-700/90 backdrop-blur-sm rounded-full text-white transition-all duration-300 hover:scale-110 border border-amber-400/30 shadow-lg"
            aria-label="Previous slide"
          >
            <ChevronLeftIcon className="w-6 h-6" />
          </button>
          <button
            onClick={nextSlide}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-3 bg-purple-800/80 hover:bg-purple-700/90 backdrop-blur-sm rounded-full text-white transition-all duration-300 hover:scale-110 border border-amber-400/30 shadow-lg"
            aria-label="Next slide"
          >
            <ChevronRightIcon className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Indicators - Purple with gold active */}
      {showIndicators && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex space-x-2">
          {slides.map((_, index) => (
            <button
              key={index}
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

      {/* Scroll Indicator - Gold */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 animate-bounce">
        <div className="w-6 h-10 border-2 border-amber-400/50 rounded-full flex justify-center">
          <div className="w-1 h-3 bg-amber-400 rounded-full mt-2 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

