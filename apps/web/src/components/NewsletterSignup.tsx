'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api';

export default function NewsletterSignup() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMessage('');

    try {
      await apiClient.newsletterSubscribe({ email, source: 'homepage' });
      setStatus('success');
      setEmail('');
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err?.message || 'Something went wrong. Please try again.');
    }
  };

  return (
    <section id="newsletter" className="bg-hos-bg-tertiary py-16 scroll-mt-24">
      <div className="max-w-xl mx-auto px-4 text-center">
        <h2 className="font-display text-hos-text-secondary text-2xl md:text-3xl font-bold">
          Subscribe to our missives
        </h2>
        <p className="text-hos-text-secondary text-sm mt-3 mb-8">
          Be the first to know about new collections, vendor spotlights, and marketplace-only offers
          — no owls required.
        </p>

        {status === 'success' ? (
          <div className="bg-hos-new-green/20 border border-hos-new-green text-hos-new-green rounded-lg px-6 py-4 max-w-md mx-auto">
            <p className="font-semibold">You&apos;re subscribed!</p>
            <p className="text-sm mt-1 opacity-80">Thank you! A confirmation email is on its way.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="flex max-w-md mx-auto">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={status === 'loading'}
                className="flex-1 bg-[#1A1A1A] border border-hos-border rounded-l-md px-4 py-3 text-white text-sm placeholder:text-hos-text-muted focus:outline-none focus:border-hos-gold disabled:opacity-50"
                aria-label="Email address"
              />
              <button
                type="submit"
                disabled={status === 'loading'}
                className="bg-hos-gold text-[#1a1406] px-6 py-3 rounded-r-md font-semibold text-sm hover:bg-hos-gold-hover transition-colors duration-200 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === 'loading' ? 'Subscribing...' : 'Subscribe'}
              </button>
            </div>

            {status === 'error' && (
              <p className="text-hos-sale-red text-sm mt-3">{errorMessage}</p>
            )}

            <div className="flex items-center justify-center gap-2 mt-4">
              <input
                id="newsletter-consent"
                type="checkbox"
                required
                disabled={status === 'loading'}
                className="accent-[#D4A847] w-4 h-4"
              />
              <label htmlFor="newsletter-consent" className="text-hos-text-muted text-xs">
                I agree to receive marketing communications from House of Spells.
              </label>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
