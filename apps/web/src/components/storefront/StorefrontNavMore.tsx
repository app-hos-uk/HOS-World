'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { STOREFRONT_NAV_MORE } from '@/lib/storefrontNavigation';

export function StorefrontNavMore() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-hos-text-secondary text-sm hover:text-hos-gold transition-colors duration-200 whitespace-nowrap"
        aria-expanded={open}
        aria-haspopup="true"
      >
        More
        <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open ? (
        <div className="absolute left-0 top-full mt-2 z-50 min-w-[200px] rounded-lg border border-hos-border bg-hos-bg shadow-lg py-2">
          {STOREFRONT_NAV_MORE.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-sm text-hos-text-secondary hover:text-hos-gold hover:bg-hos-bg-secondary transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
