'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, markLoginSuccess, mergeGuestCartAfterAuth } from '@/lib/api';
import { consumeAuthReturnUrl, resolvePostAuthRedirect } from '@/lib/authRedirect';

export function AuthCallbackClient() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await mergeGuestCartAfterAuth();
        markLoginSuccess();
        const me = await apiClient.getCurrentUser();
        const role = me?.data?.role ? String(me.data.role).toUpperCase() : undefined;
        const returnUrl = consumeAuthReturnUrl();
        router.replace(resolvePostAuthRedirect(role, returnUrl));
      } catch (e: any) {
        document.cookie = 'is_logged_in=; path=/; max-age=0';
        setError(e?.message || 'OAuth login failed.');
      }
    })();
  }, [router]);

  if (!error) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-hos-bg to-hos-bg-secondary flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="max-w-md w-full bg-hos-bg-secondary rounded-xl shadow-lg p-6 sm:p-8 text-center">
        <h1 className="text-xl font-bold text-red-400 mb-2">Login failed</h1>
        <p className="text-sm text-hos-text-secondary mb-6">{error}</p>
        <button
          onClick={() => router.replace('/login')}
          className="w-full bg-hos-gold text-[#1a1406] py-3 rounded-lg font-semibold hover:bg-hos-gold-hover transition-colors"
        >
          Back to Login
        </button>
      </div>
    </div>
  );
}
