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

export default function HomePage() {
  
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
        {/* 1. Hero Banner + Trust Strip */}
        <HeroBanner
          animationType="fade"
          autoPlay={true}
          autoPlayInterval={5000}
          showIndicators={true}
          showArrows={true}
        />

        {/* 2. Shop by Franchise */}
        <FandomCollection limit={8} />

        {/* 3. Browse by Department */}
        <BrowseByDepartment />

        {/* 4. This Week on the Marketplace */}
        <WeeklyPicks />

        {/* 5. Enchanted Finds */}
        <EnchantedFinds />

        {/* 6. Featured Franchises */}
        <FeaturedFranchises />

        {/* Recently Viewed (if any) */}
        <section className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
          <RecentlyViewed />
        </section>

        {/* 7. Testimonials */}
        <Testimonials />

        {/* 8. Sell on HOS */}
        <VendorCTA />

        {/* 9. Blog / From the Grimoire */}
        <BlogPreview />

        {/* 10. Payment Icons */}
        <PaymentIcons />

        {/* 11. Newsletter */}
        <NewsletterSignup />
      </main>

      {/* 12. Footer */}
      <Footer />
    </div>
  );
}
