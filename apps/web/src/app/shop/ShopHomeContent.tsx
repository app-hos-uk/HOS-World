'use client';

import { Header } from '@/components/Header';
import { HeroBanner } from '@/components/HeroBanner';
import { BannerCarousel } from '@/components/BannerCarousel';
import { FeatureBanner } from '@/components/FeatureBanner';
import { FandomCollection } from '@/components/FandomCollection';
import BrowseByDepartment from '@/components/BrowseByDepartment';
import { RecentlyViewed } from '@/components/RecentlyViewed';
import WeeklyPicks from '@/components/WeeklyPicks';
import EnchantedFinds from '@/components/EnchantedFinds';
import FeaturedFranchises from '@/components/FeaturedFranchises';
import Testimonials from '@/components/Testimonials';
import VendorCTA from '@/components/VendorCTA';
import BlogPreview from '@/components/BlogPreview';
import PaymentIcons from '@/components/PaymentIcons';
import NewsletterSignup from '@/components/NewsletterSignup';
import { Footer } from '@/components/Footer';
import type { CmsCarouselBanner, CmsFeatureBanner, CmsHeroSlide } from '@/lib/cms';
import { getSiteUrl } from '@/lib/siteUrls';

interface ShopHomeContentProps {
  heroSlides: CmsHeroSlide[];
  promotionalBanners: CmsCarouselBanner[];
  sidebarBanners: CmsFeatureBanner[];
}

export function ShopHomeContent({
  heroSlides,
  promotionalBanners,
  sidebarBanners,
}: ShopHomeContentProps) {
  const siteUrl = getSiteUrl();
  return (
    <div className="min-h-screen bg-hos-bg">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'House of Spells',
            url: siteUrl,
            logo: `${siteUrl}/logo.png`,
            description: 'Magical merchandise marketplace for fandom collectibles',
            sameAs: [],
          }),
        }}
      />
      <Header />
      <main>
        <HeroBanner
          slides={heroSlides.length > 0 ? heroSlides : undefined}
          animationType="fade"
          autoPlay={true}
          autoPlayInterval={5000}
          showIndicators={true}
          showArrows={true}
        />

        {promotionalBanners.length > 0 && (
          <section className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
            <BannerCarousel banners={promotionalBanners} scrollSpeed="medium" direction="left" />
          </section>
        )}

        <FandomCollection limit={12} />

        <BrowseByDepartment />

        {sidebarBanners.length > 0 && (
          <section className="max-w-7xl mx-auto px-4 py-8 sm:py-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {sidebarBanners.map((banner) => (
                <FeatureBanner
                  key={banner.id}
                  title={banner.title}
                  description={banner.description}
                  image={banner.image}
                  link={banner.link}
                  buttonText={banner.buttonText}
                  variant="gradient"
                />
              ))}
            </div>
          </section>
        )}

        <WeeklyPicks />

        <EnchantedFinds />

        <FeaturedFranchises />

        <section className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
          <RecentlyViewed />
        </section>

        <Testimonials />

        <VendorCTA />

        <BlogPreview />

        <PaymentIcons />

        <NewsletterSignup />
      </main>

      <Footer />
    </div>
  );
}
