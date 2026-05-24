'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function ProductsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Products error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto w-14 h-14 rounded-full bg-red-500/15 flex items-center justify-center">
          <svg
            className="w-7 h-7 text-red-400"
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

        <h1 className="text-2xl font-bold text-white font-[family-name:var(--font-display)]">
          Products Error
        </h1>

        <p className="text-hos-text-secondary font-[family-name:var(--font-body)]">
          {error.message || 'Something went wrong loading products.'}
        </p>

        {error.digest && (
          <p className="text-xs text-hos-text-muted">Error ID: {error.digest}</p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <button
            onClick={reset}
            className="px-5 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors font-medium text-sm"
          >
            Try Again
          </button>
          <Link
            href="/products"
            className="px-5 py-2 border border-hos-border-accent text-hos-gold-hover rounded-lg hover:bg-hos-gold/10 transition-colors font-medium text-sm"
          >
            Browse Products
          </Link>
        </div>
      </div>
    </div>
  );
}
