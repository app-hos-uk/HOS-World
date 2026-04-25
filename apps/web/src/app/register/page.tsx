'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function RegisterRedirectInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const didRedirect = useRef(false);

  useEffect(() => {
    if (didRedirect.current) return;
    didRedirect.current = true;
    const ref = sp.get('ref');
    const qs = ref ? `?register=1&ref=${encodeURIComponent(ref)}` : '?register=1';
    router.replace(`/login${qs}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-950 text-stone-400 font-secondary text-sm">
      Redirecting to sign up…
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-stone-950 text-stone-400 font-secondary text-sm">
          Loading…
        </div>
      }
    >
      <RegisterRedirectInner />
    </Suspense>
  );
}
