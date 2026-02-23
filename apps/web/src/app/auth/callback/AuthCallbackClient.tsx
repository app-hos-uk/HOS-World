'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiClient, markLoginSuccess } from '@/lib/api';

export function AuthCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    const refreshToken = searchParams.get('refreshToken');

    if (!token) {
      setError('Missing token from OAuth callback.');
      return;
    }

    try {
      localStorage.setItem('auth_token', token);
      if (refreshToken) {
        localStorage.setItem('refresh_token', refreshToken);
      }
      markLoginSuccess();
    } catch (e) {
      setError('Failed to persist login session.');
      return;
    }

    (async () => {
      try {
        const me = await apiClient.getCurrentUser();
        const role = me?.data?.role ? String(me.data.role).toUpperCase() : null;

        const roleDashboardMap: Record<string, string> = {
          CUSTOMER: '/customer/dashboard',
          WHOLESALER: '/wholesaler/dashboard',
          B2C_SELLER: '/seller/dashboard',
          SELLER: '/seller/dashboard',
          ADMIN: '/admin/dashboard',
          INFLUENCER: '/influencer/dashboard',
          PROCUREMENT: '/procurement/dashboard',
          FULFILLMENT: '/fulfillment/dashboard',
          CATALOG: '/catalog/dashboard',
          MARKETING: '/marketing/dashboard',
          FINANCE: '/finance/dashboard',
          CMS_EDITOR: '/cms/dashboard',
        };

        router.replace(roleDashboardMap[role || ''] || '/');
      } catch (e: any) {
        try {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('refresh_token');
        } catch {
          // ignore
        }
        setError(e?.message || 'OAuth login failed.');
      }
    })();
  }, [router, searchParams]);

  if (!error) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6 sm:p-8 text-center">
        <h1 className="text-xl font-bold text-red-600 mb-2">Login failed</h1>
        <p className="text-sm text-gray-700 mb-6">{error}</p>
        <button
          onClick={() => router.replace('/login')}
          className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors"
        >
          Back to Login
        </button>
      </div>
    </div>
  );
}


