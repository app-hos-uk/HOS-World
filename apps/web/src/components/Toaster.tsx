'use client';

import { Toaster as HotToaster, ToastBar, toast } from 'react-hot-toast';

export function Toaster() {
  return (
    <HotToaster
      position="bottom-center"
      gutter={8}
      toastOptions={{
        duration: 4000,
        style: {
          background: '#1A1A1A',
          color: '#B0B0B0',
          padding: '16px',
          borderRadius: '8px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -2px rgba(0, 0, 0, 0.3)',
          fontSize: '14px',
          maxWidth: '400px',
          border: '1px solid #2A2A2A',
        },
        success: {
          iconTheme: {
            primary: '#27AE60',
            secondary: '#1A1A1A',
          },
          style: {
            border: '1px solid #27AE60',
          },
        },
        error: {
          iconTheme: {
            primary: '#C0392B',
            secondary: '#1A1A1A',
          },
          style: {
            border: '1px solid #C0392B',
          },
        },
        loading: {
          iconTheme: {
            primary: '#D4A847',
            secondary: '#1A1A1A',
          },
        },
      }}
    >
      {(t) => (
        <ToastBar toast={t}>
          {({ icon, message }) => (
            <div className="flex items-center gap-2 w-full">
              {icon}
              <span className="flex-1 min-w-0">{message}</span>
              {t.type !== 'loading' && (
                <button
                  type="button"
                  onClick={() => toast.dismiss(t.id)}
                  className="shrink-0 p-1 rounded hover:bg-hos-bg-tertiary text-hos-text-muted hover:text-hos-gold transition-colors"
                  aria-label="Dismiss notification"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </ToastBar>
      )}
    </HotToaster>
  );
}

