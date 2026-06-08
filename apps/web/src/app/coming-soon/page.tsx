'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

function ComingSoonContent() {
  const searchParams = useSearchParams();
  const franchise = searchParams.get('franchise') || 'This Collection';

  return (
    <div className="min-h-screen bg-hos-bg flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-lg w-full text-center space-y-6">
          <div className="text-6xl mb-4">✨</div>
          <h1 className="text-3xl sm:text-4xl font-bold text-hos-text-primary">
            {franchise}
          </h1>
          <p className="text-lg text-hos-text-secondary">
            Coming Soon
          </p>
          <p className="text-hos-text-muted">
            We&apos;re working on bringing you an amazing collection. 
            Stay tuned for exclusive merchandise and collectibles!
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
            <Link
              href="/fandoms"
              className="px-6 py-3 text-sm font-semibold rounded-lg bg-hos-gold text-[#1a1406] hover:bg-hos-gold-hover transition-colors"
            >
              Browse Other Franchises
            </Link>
            <Link
              href="/shop"
              className="px-6 py-3 text-sm font-semibold rounded-lg border border-hos-border text-hos-text-secondary hover:border-hos-gold hover:text-hos-gold transition-colors"
            >
              Back to Shop
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function ComingSoonPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-hos-bg" />}>
      <ComingSoonContent />
    </Suspense>
  );
}
