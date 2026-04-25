'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global application error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #faf5ff, #fff)',
            padding: '1rem',
          }}
        >
          <div style={{ maxWidth: '28rem', textAlign: 'center' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#581c87' }}>
              Something Went Wrong
            </h1>
            <p style={{ color: '#6b7280', margin: '1rem 0' }}>
              An unexpected error occurred. Please try again or return to the homepage.
            </p>
            {error.digest && (
              <p style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Error ID: {error.digest}</p>
            )}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1.5rem' }}>
              <button
                onClick={reset}
                style={{
                  padding: '0.625rem 1.5rem',
                  background: '#7e22ce',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Try Again
              </button>
              <a
                href="/"
                style={{
                  padding: '0.625rem 1.5rem',
                  border: '1px solid #d8b4fe',
                  color: '#7e22ce',
                  borderRadius: '0.5rem',
                  textDecoration: 'none',
                  fontWeight: 500,
                }}
              >
                Go Home
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
