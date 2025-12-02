import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export default function ShippingPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="container mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold mb-8">Shipping Information</h1>
        <div className="max-w-3xl mx-auto space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4">Shipping Options</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-medium mb-2">Standard Shipping</h3>
                <p className="text-gray-600">
                  5-7 business days - $5.99
                </p>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">Express Shipping</h3>
                <p className="text-gray-600">
                  2-3 business days - $12.99
                </p>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">Overnight Shipping</h3>
                <p className="text-gray-600">
                  Next business day - $24.99
                </p>
              </div>
            </div>
          </section>
          <section>
            <h2 className="text-2xl font-semibold mb-4">Free Shipping</h2>
            <p className="text-gray-600">
              Free standard shipping on orders over $50!
            </p>
          </section>
          <section>
            <h2 className="text-2xl font-semibold mb-4">International Shipping</h2>
            <p className="text-gray-600">
              We ship worldwide! International shipping rates and delivery times vary by location.
              Please contact us for specific rates to your country.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}

