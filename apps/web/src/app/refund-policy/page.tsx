import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import Link from 'next/link';

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-hos-bg-secondary">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12 max-w-3xl">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-6 sm:mb-8">Refund Policy</h1>
        <div className="space-y-6 sm:space-y-8 text-hos-text-secondary text-sm sm:text-base">
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3 text-hos-text-secondary">Eligibility</h2>
            <p>
              Most items may be returned within 30 days of delivery if they are unused, in original packaging, and
              accompanied by proof of purchase. Some collectibles, personalised items, or final-sale products may be
              excluded.
            </p>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3 text-hos-text-secondary">How to request a refund</h2>
            <p>
              Signed-in customers can start a return from{' '}
              <Link href="/returns" className="text-hos-gold hover:text-hos-gold-hover">
                My Returns
              </Link>{' '}
              or by opening a ticket via{' '}
              <Link href="/support/new" className="text-hos-gold hover:text-hos-gold-hover">
                Contact Us
              </Link>
              . Include your order number and the reason for the return.
            </p>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3 text-hos-text-secondary">Processing time</h2>
            <p>
              Approved refunds are issued to the original payment method. Gift card purchases are credited back to the
              gift card balance where applicable. Please allow 5–10 business days for your bank or card issuer to post the
              credit after approval.
            </p>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3 text-hos-text-secondary">Shipping costs</h2>
            <p>
              Return shipping may be deducted from your refund unless the return is due to our error or a defective
              item. See our{' '}
              <Link href="/shipping" className="text-hos-gold hover:text-hos-gold-hover">
                Shipping Policy
              </Link>{' '}
              for delivery terms.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
