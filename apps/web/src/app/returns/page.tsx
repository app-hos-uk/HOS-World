import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export default function ReturnsPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="container mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold mb-8">Returns & Refunds</h1>
        <div className="max-w-3xl mx-auto space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4">Return Policy</h2>
            <p className="text-gray-600 mb-4">
              We want you to be completely satisfied with your purchase. You can return most items
              within 30 days of delivery for a full refund.
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-600">
              <li>Items must be in original condition with tags attached</li>
              <li>Returns must be initiated within 30 days of delivery</li>
              <li>Original shipping costs are non-refundable</li>
              <li>Custom or personalized items may not be returnable</li>
            </ul>
          </section>
          <section>
            <h2 className="text-2xl font-semibold mb-4">How to Return</h2>
            <ol className="list-decimal list-inside space-y-2 text-gray-600">
              <li>Log into your account and go to "My Orders"</li>
              <li>Select the item you want to return</li>
              <li>Click "Request Return" and follow the instructions</li>
              <li>Print the return label and ship the item back</li>
              <li>Once we receive your return, we'll process your refund</li>
            </ol>
          </section>
          <section>
            <h2 className="text-2xl font-semibold mb-4">Refund Processing</h2>
            <p className="text-gray-600">
              Refunds will be processed to your original payment method within 5-10 business days
              after we receive your return.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}

