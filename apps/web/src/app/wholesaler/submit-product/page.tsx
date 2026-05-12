'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function WholesalerSubmitProductRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const id = searchParams.get('id');
    const edit = searchParams.get('edit');
    const qs = new URLSearchParams();
    if (id) qs.set('id', id);
    if (edit) qs.set('edit', edit);
    const suffix = qs.toString();
    router.replace(suffix ? `/seller/submit-product?${suffix}` : '/seller/submit-product');
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

export default function WholesalerSubmitProductPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
      </div>
    }>
      <WholesalerSubmitProductRedirect />
    </Suspense>
  );
}
