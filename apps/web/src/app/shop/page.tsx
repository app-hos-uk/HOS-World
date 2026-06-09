'use client';

import { Header } from '@/components/Header';
import { HeroBanner } from '@/components/HeroBanner';
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

export default function ShopHomePage() {
  return (
    <div className="min-h-screen bg-hos-bg">
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
        <HeroBanner
          animationType="fade"
          autoPlay={true}
          autoPlayInterval={5000}
          showIndicators={true}
          showArrows={true}
        />

        <FandomCollection limit={12} />

        <BrowseByDepartment />

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
