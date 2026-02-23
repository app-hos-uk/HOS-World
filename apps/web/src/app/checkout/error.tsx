'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function CheckoutError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Checkout error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
          <svg
            className="w-7 h-7 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 font-[family-name:var(--font-cinzel)]">
          Checkout Error
        </h1>

        <p className="text-gray-600 font-[family-name:var(--font-lora)]">
          {error.message || 'Something went wrong during checkout. Your payment has not been processed.'}
        </p>

        {error.digest && (
          <p className="text-xs text-gray-400">Error ID: {error.digest}</p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <button
            onClick={reset}
            className="px-5 py-2 bg-purple-700 text-white rounded-lg hover:bg-purple-800 transition-colors font-medium text-sm"
          >
            Try Again
          </button>
          <Link
            href="/cart"
            className="px-5 py-2 border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50 transition-colors font-medium text-sm"
          >
            Back to Cart
          </Link>
        </div>
      </div>
    </div>
  );
}
