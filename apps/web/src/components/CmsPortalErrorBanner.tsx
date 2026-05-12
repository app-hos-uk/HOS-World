'use client';

import Link from 'next/link';
import { type ReactNode } from 'react';

export function CmsPortalErrorBanner({
  message,
  showSettingsLink = true,
  children,
}: {
  message: string | null;
  /** When false (e.g. on CMS Settings), hide the redundant self-link */
  showSettingsLink?: boolean;
  children?: ReactNode;
}) {
  if (!message) return null;
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm mb-6" role="status">
      <p className="font-medium text-amber-950">Content unavailable</p>
      <p className="mt-1 text-amber-900">{message}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {showSettingsLink ? (
          <Link href="/cms/settings" className="inline-flex font-medium text-purple-700 underline hover:text-purple-800">
            Open CMS Settings
          </Link>
        ) : null}
        {children}
      </div>
    </div>
  );
}
