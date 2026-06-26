'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSecureUrlToken } from '@/hooks/useSecureUrlToken';
import { getPublicApiBaseUrl } from '@/lib/apiBaseUrl';

function VerifyEmailContent() {
  const router = useRouter();
  const token = useSecureUrlToken();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token provided.');
      return;
    }

    const verify = async () => {
      try {
        const res = await fetch(
          `${getPublicApiBaseUrl()}/auth/verify-email`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
          },
        );

        if (res.ok) {
          setStatus('success');
          setMessage('Your email has been verified successfully!');
          setTimeout(() => router.push('/login'), 3000);
        } else {
          const data = await res.json().catch(() => ({}));
          setStatus('error');
          setMessage(data?.message || 'Invalid or expired verification token.');
        }
      } catch {
        setStatus('error');
        setMessage('Something went wrong. Please try again later.');
      }
    };

    verify();
  }, [token, router]);

  return (
    <div className="min-h-screen bg-hos-bg flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {status === 'loading' && (
          <div className="space-y-4">
            <div className="w-12 h-12 border-4 border-hos-gold border-t-transparent rounded-full animate-spin mx-auto" />
            <h1 className="text-2xl font-display text-hos-text-secondary">Verifying your email...</h1>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4">
            <div className="w-16 h-16 bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-display text-hos-text-secondary">Email Verified!</h1>
            <p className="text-hos-text-muted">{message}</p>
            <p className="text-hos-text-muted text-sm">Redirecting to login...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <div className="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-2xl font-display text-hos-text-secondary">Verification Failed</h1>
            <p className="text-hos-text-muted">{message}</p>
            <Link
              href="/login"
              className="inline-block mt-4 px-6 py-2 bg-hos-gold text-hos-bg rounded-lg font-semibold hover:bg-hos-gold-hover transition-colors"
            >
              Go to Login
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-hos-bg flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-hos-gold border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
