import { Suspense } from 'react';
import { AuthCallbackClient } from './AuthCallbackClient';

// This page depends on URL search params; it must not be prerendered.
export const dynamic = 'force-dynamic';

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4 sm:p-6 lg:p-8">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6 sm:p-8 text-center">
            <h1 className="text-xl font-bold text-purple-600 mb-2">Signing you in…</h1>
            <p className="text-sm text-gray-600">Please wait while we complete your login.</p>
          </div>
        </div>
      }
    >
      <AuthCallbackClient />
    </Suspense>
  );
}


