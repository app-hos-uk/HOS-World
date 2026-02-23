'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';

export default function WholesalerOnboardingPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/seller/onboarding');
  }, [router]);

  return (
    <RouteGuard allowedRoles={['WHOLESALER', 'ADMIN']} showAccessDenied={true}>
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting to onboarding...</p>
        </div>
      </div>
    </RouteGuard>
  );
}
