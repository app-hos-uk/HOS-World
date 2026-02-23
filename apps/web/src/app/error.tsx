'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-white px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-purple-600"
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

        <h1 className="text-3xl font-bold text-purple-900 font-[family-name:var(--font-cinzel)]">
          Something Went Wrong
        </h1>

        <p className="text-gray-600 font-[family-name:var(--font-lora)]">
          {error.message || 'An unexpected error occurred. Please try again.'}
        </p>

        {error.digest && (
          <p className="text-xs text-gray-400">Error ID: {error.digest}</p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <button
            onClick={reset}
            className="px-6 py-2.5 bg-purple-700 text-white rounded-lg hover:bg-purple-800 transition-colors font-medium"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="px-6 py-2.5 border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50 transition-colors font-medium"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
