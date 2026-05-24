'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function WholesalerThemesPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/seller/themes');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-hos-gold mx-auto mb-4"></div>
        <p className="text-hos-text-secondary">Loading themes...</p>
      </div>
    </div>
  );
}
