import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import Link from 'next/link';

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-hos-bg-secondary">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12 max-w-3xl">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-6 sm:mb-8">Terms of Service</h1>
        <div className="space-y-6 sm:space-y-8 text-hos-text-secondary text-sm sm:text-base">
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3 text-hos-text-secondary">Agreement</h2>
            <p>
              By accessing or using House of Spells, you agree to these Terms of Service and our{' '}
              <Link href="/privacy-policy" className="text-hos-gold hover:text-hos-gold-hover">
                Privacy Policy
              </Link>
              . If you do not agree, please do not use the platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3 text-hos-text-secondary">Use of the marketplace</h2>
            <p>
              You may browse, purchase, and interact with sellers and content on House of Spells for lawful personal
              or business purposes. You are responsible for keeping your account credentials secure and for all
              activity under your account.
            </p>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3 text-hos-text-secondary">Orders & payments</h2>
            <p>
              Product availability, pricing, and fulfillment are provided by sellers and House of Spells as displayed
              at checkout. We reserve the right to refuse or cancel orders affected by pricing errors, suspected fraud,
              or stock issues.
            </p>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3 text-hos-text-secondary">Returns & disputes</h2>
            <p>
              Returns, refunds, and shipping terms are described in our{' '}
              <Link href="/returns" className="text-hos-gold hover:text-hos-gold-hover">
                Refund Policy
              </Link>{' '}
              and{' '}
              <Link href="/shipping" className="text-hos-gold hover:text-hos-gold-hover">
                Shipping Policy
              </Link>
              . For help with an order, visit the{' '}
              <Link href="/help" className="text-hos-gold hover:text-hos-gold-hover">
                Help Center
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3 text-hos-text-secondary">Contact</h2>
            <p>
              Questions about these terms?{' '}
              <Link href="/support/new" className="text-hos-gold hover:text-hos-gold-hover">
                Contact us
              </Link>{' '}
              or email{' '}
              <a href="mailto:info@houseofspells.com" className="text-hos-gold hover:text-hos-gold-hover">
                info@houseofspells.com
              </a>
              .
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
