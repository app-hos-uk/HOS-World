'use client';

import Link from 'next/link';

export default function VendorCTA() {
  return (
    <section className="py-16">
      <div className="max-w-7xl mx-auto px-4">
        <div className="bg-hos-bg-secondary border border-hos-border rounded-2xl p-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="md:w-3/5">
            <h2 className="font-display text-white text-2xl md:text-3xl font-bold">
              Sell on House of Spells
            </h2>
            <p className="text-hos-text-secondary text-sm leading-relaxed mt-3">
              Reach obsessed fans across the US — list collectables, apparel, and home goods alongside
              our house lines. We handle discovery, compliance basics, and payouts on a predictable
              schedule — you focus on stock and storytelling.
            </p>
          </div>

          <div className="md:w-2/5 flex flex-col sm:flex-row items-center justify-end gap-3 w-full md:w-auto">
            <a
              href="mailto:info@houseofspells.com?subject=Marketplace%20vendor%20inquiry"
              className="inline-flex items-center justify-center bg-hos-gold text-[#1a1406] px-6 py-2.5 rounded-md font-semibold text-sm hover:bg-hos-gold-hover transition-colors duration-200 w-full sm:w-auto"
            >
              Apply to sell
            </a>
            <Link
              href="/help"
              className="inline-flex items-center justify-center border border-hos-gold text-hos-gold px-6 py-2.5 rounded-md font-semibold text-sm hover:bg-hos-gold hover:text-[#1a1406] transition-colors duration-200 w-full sm:w-auto"
            >
              Read seller policies
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
