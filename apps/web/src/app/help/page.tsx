import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-6 sm:mb-8">Help Center</h1>
        <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8">
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">Frequently Asked Questions</h2>
            <div className="space-y-3 sm:space-y-4">
              <div>
                <h3 className="text-lg sm:text-xl font-medium mb-2">How do I place an order?</h3>
                <p className="text-sm sm:text-base text-gray-600">
                  Browse our products, add items to your cart, and proceed to checkout.
                </p>
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-medium mb-2">How can I track my order?</h3>
                <p className="text-sm sm:text-base text-gray-600">
                  Once your order ships, you&apos;ll receive a tracking number via email.
                </p>
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-medium mb-2">What payment methods do you accept?</h3>
                <p className="text-sm sm:text-base text-gray-600">
                  We accept all major credit cards and PayPal.
                </p>
              </div>
            </div>
          </section>

          <section className="bg-purple-50 border border-purple-200 rounded-xl p-6 sm:p-8">
            <h2 className="text-xl sm:text-2xl font-semibold mb-2">Need More Help?</h2>
            <p className="text-sm sm:text-base text-gray-600 mb-4">
              Can&apos;t find what you&apos;re looking for? Submit a support ticket and our team will get back to you within 24 hours.
            </p>
            <Link
              href="/support/new"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium transition-colors"
            >
              Submit a Support Ticket
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">Contact Support</h2>
            <p className="text-sm sm:text-base text-gray-600 mb-3 sm:mb-4">
              You can also reach us directly:
            </p>
            <p className="text-sm sm:text-base text-gray-600">
              Email: support@houseofspells.com<br />
              Phone: 1-800-HOS-HELP
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}

