'use client';

const PAYMENT_METHODS = ['Visa', 'Mastercard', 'Amex', 'PayPal', 'Apple Pay'];

export default function PaymentIcons() {
  return (
    <section className="py-6 border-t border-hos-border">
      <div className="max-w-7xl mx-auto px-4 text-center">
        <p className="text-hos-text-muted text-xs mb-3">Secure payments</p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          {PAYMENT_METHODS.map((method) => (
            <span
              key={method}
              className="border border-hos-border rounded px-3 py-1 text-hos-text-secondary text-xs font-ui"
            >
              {method}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
