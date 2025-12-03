import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="container mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold mb-8">Help Center</h1>
        <div className="max-w-3xl mx-auto space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4">Frequently Asked Questions</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-medium mb-2">How do I place an order?</h3>
                <p className="text-gray-600">
                  Browse our products, add items to your cart, and proceed to checkout.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">How can I track my order?</h3>
                <p className="text-gray-600">
                  Once your order ships, you&apos;ll receive a tracking number via email.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">What payment methods do you accept?</h3>
                <p className="text-gray-600">
                  We accept all major credit cards and PayPal.
                </p>
              </div>
            </div>
          </section>
          <section>
            <h2 className="text-2xl font-semibold mb-4">Contact Support</h2>
            <p className="text-gray-600 mb-4">
              Need more help? Contact our support team:
            </p>
            <p className="text-gray-600">
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

