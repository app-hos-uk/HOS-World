'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { SubmitProductForm } from './SubmitProductForm';
import { SubmissionViewMode } from './SubmissionViewMode';

function SubmitProductContent() {
  const searchParams = useSearchParams();
  const submissionId = searchParams.get('id');

  if (submissionId) {
    return <SubmissionViewMode submissionId={submissionId} />;
  }

  return <SubmitProductForm />;
}

export default function SubmitProductPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      }
    >
      <SubmitProductContent />
    </Suspense>
  );
}
