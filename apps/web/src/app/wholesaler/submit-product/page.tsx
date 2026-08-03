'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { SubmitProductForm } from '../../seller/submit-product/SubmitProductForm';
import { SubmissionViewMode } from '../../seller/submit-product/SubmissionViewMode';

function WholesalerSubmitProductContent() {
  const searchParams = useSearchParams();
  const viewId = searchParams.get('id');
  const editId = searchParams.get('edit');

  if (viewId) {
    return <SubmissionViewMode submissionId={viewId} />;
  }

  return <SubmitProductForm editSubmissionId={editId || undefined} />;
}

export default function WholesalerSubmitProductPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-hos-gold"></div>
        </div>
      }
    >
      <WholesalerSubmitProductContent />
    </Suspense>
  );
}
