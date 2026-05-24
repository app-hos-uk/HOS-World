'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { SubmitProductForm } from './SubmitProductForm';
import { SubmissionViewMode } from './SubmissionViewMode';

function SubmitProductContent() {
  const searchParams = useSearchParams();
  const viewId = searchParams.get('id');
  const editId = searchParams.get('edit');

  if (viewId) {
    return <SubmissionViewMode submissionId={viewId} />;
  }

  return <SubmitProductForm editSubmissionId={editId || undefined} />;
}

export default function SubmitProductPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-hos-gold"></div>
        </div>
      }
    >
      <SubmitProductContent />
    </Suspense>
  );
}
