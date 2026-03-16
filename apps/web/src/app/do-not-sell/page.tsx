'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { getPublicApiBaseUrl } from '@/lib/apiBaseUrl';

export default function DoNotSellPage() {
  const [email, setEmail] = useState('');
  const [optOut, setOptOut] = useState(true);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setMessage('Please enter your email address.');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setMessage('');

    try {
      const apiUrl = getPublicApiBaseUrl();
      const res = await fetch(`${apiUrl}/gdpr/do-not-sell`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          optOut: optOut,
          email: email.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStatus('error');
        setMessage(data?.message || 'Request failed. Please try again.');
        return;
      }

      setStatus('success');
      setMessage('Your Do Not Sell preference has been recorded successfully.');
      setEmail('');
    } catch (err) {
      setStatus('error');
      setMessage('Something went wrong. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 max-w-2xl">
        <h1 className="text-3xl sm:text-4xl font-bold mb-6 text-gray-900">
          Do Not Sell or Share My Personal Information
        </h1>

        <section className="mb-8 text-gray-700 space-y-4">
          <p>
            Under the California Consumer Privacy Act (CCPA) and similar laws, you have the right to
            opt out of the &quot;sale&quot; or &quot;sharing&quot; of your personal information.
          </p>
          <p>
            We do not sell your personal information for monetary consideration. &quot;Sharing&quot;
            under CCPA includes disclosing personal information for cross-context behavioral
            advertising. You may opt out of any such sharing at any time.
          </p>
          <p>
            Use the form below to submit your opt-out request. We will process your request in
            accordance with applicable law.
          </p>
        </section>

        <form onSubmit={handleSubmit} className="space-y-6 p-6 bg-gray-50 rounded-xl border border-purple-100">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              disabled={status === 'loading'}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white disabled:opacity-70"
            />
          </div>

          <div className="flex items-start gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={optOut}
                onChange={(e) => setOptOut(e.target.checked)}
                disabled={status === 'loading'}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              <span className="ml-3 text-sm font-medium text-gray-700">
                I wish to opt out of the sale or sharing of my personal information
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full px-6 py-3 text-white font-semibold rounded-lg bg-purple-600 hover:bg-purple-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {status === 'loading' ? 'Submitting…' : 'Submit Opt-Out Request'}
          </button>
        </form>

        {message && (
          <div
            role="alert"
            className={`mt-6 p-4 rounded-lg ${
              status === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {message}
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-gray-200">
          <Link
            href="/privacy-policy"
            className="text-purple-600 hover:text-purple-800 font-medium"
          >
            ← Back to Privacy Policy
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
