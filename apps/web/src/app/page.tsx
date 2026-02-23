'use client';

import { Header } from '@/components/Header';
import { SearchBar } from '@/components/SearchBar';
import { HeroBanner } from '@/components/HeroBanner';
import { BannerCarousel } from '@/components/BannerCarousel';
import { FeatureBanner } from '@/components/FeatureBanner';
import { FandomCollection } from '@/components/FandomCollection';
import { RecentlyViewed } from '@/components/RecentlyViewed';
import { Footer } from '@/components/Footer';

/**
 * Featured Banners for Carousel
 * 
 * Image Specifications:
 * - All images should be 800x600px (4:3 aspect ratio)
 * - Format: JPG or WebP
 * - Max file size: 200KB
 * - Place images in: /public/banners/
 * 
 * See: /public/IMAGE_SPECIFICATIONS.md for detailed requirements
 */
const featuredBanners = [
  {
    id: 1,
    title: 'New Arrivals',
    image: '/banners/new-arrivals.svg', // Placeholder - replace with JPG (800x600px, max 200KB)
    link: '/products?filter=new',
    badge: 'New',
  },
  {
    id: 2,
    title: 'Best Sellers',
    image: '/banners/best-sellers.svg', // Placeholder - replace with JPG (800x600px, max 200KB)
    link: '/products?filter=bestsellers',
    badge: 'Hot',
  },
  {
    id: 3,
    title: 'Limited Edition',
    image: '/banners/limited-edition.svg', // Placeholder - replace with JPG (800x600px, max 200KB)
    link: '/products?filter=limited',
    badge: 'Limited',
  },
  {
    id: 4,
    title: 'Sale Items',
    image: '/banners/sale.svg', // Placeholder - replace with JPG (800x600px, max 200KB)
    link: '/products?filter=sale',
    badge: 'Sale',
  },
];


export default function HomePage() {
  
  return (
    <div className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'House of Spells',
            url: 'https://hos-marketplaceweb-production.up.railway.app',
            logo: 'https://hos-marketplaceweb-production.up.railway.app/logo.png',
            description: 'Magical merchandise marketplace for fandom collectibles',
            sameAs: [],
          }),
        }}
      />
      <Header />
      <main>
        {/* Search bar at the very top */}
        <div className="w-full bg-white border-b border-purple-100">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
            <SearchBar />
          </div>
        </div>

        {/* Hero Banner with Auto-play */}
        <HeroBanner
          animationType="fade"
          autoPlay={true}
          autoPlayInterval={5000}
          showIndicators={true}
          showArrows={true}
        />

        {/* Scrolling Banner Carousel */}
        <BannerCarousel
          banners={featuredBanners}
          scrollSpeed="medium"
          direction="left"
        />

        {/* Feature Banner Section */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
            <FeatureBanner
              title="Exclusive Collectibles"
              description="Rare and authentic items from your favorite fandoms"
              image="/featured/collectibles.svg" // Placeholder - replace with JPG (1920x1080px, max 400KB)
              link="/products?category=collectibles"
              buttonText="Shop Collectibles"
              position="left"
              variant="gradient"
            />
            <FeatureBanner
              title="Magical Apparel"
              description="Wear your fandom with pride - official merchandise"
              image="/featured/apparel.svg" // Placeholder - replace with JPG (1920x1080px, max 400KB)
              link="/products?category=apparel"
              buttonText="Shop Apparel"
              position="right"
              variant="overlay"
            />
          </div>
        </section>

        {/* Fandom Collection section */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="mb-6 sm:mb-8">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-3 sm:mb-4 font-primary text-purple-900 px-4">
              Explore Fandoms
            </h2>
            <p className="text-center text-purple-700 text-base sm:text-lg font-secondary max-w-2xl mx-auto px-4">
              Discover magical items from your favorite worlds
            </p>
          </div>
          <FandomCollection limit={6} />
        </section>

        {/* Recently Viewed section */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <RecentlyViewed />
        </section>
      </main>
      <Footer />
    </div>
  );
}


