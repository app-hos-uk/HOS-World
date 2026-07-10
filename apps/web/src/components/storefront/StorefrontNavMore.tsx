'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { getNavMore, type NavLink } from '@/lib/storefrontNavigation';

export function StorefrontNavMore({ items }: { items?: NavLink[] }) {
  const navItems = items ?? getNavMore();
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updateMenuPosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setMenuPosition({ top: rect.bottom + 8, left: rect.left });
  }, []);

  useEffect(() => {
    if (!open) return;
    updateMenuPosition();
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [open, updateMenuPosition]);

  const menuMarkup =
    open && typeof document !== 'undefined' ? (
      <div
        ref={menuRef}
        role="menu"
        className="fixed z-[60] min-w-[200px] rounded-lg border border-hos-border bg-hos-bg shadow-xl py-2"
        style={{ top: menuPosition.top, left: menuPosition.left }}
      >
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm text-hos-text-secondary hover:text-hos-gold hover:bg-hos-bg-secondary transition-colors"
          >
            {item.label}
          </Link>
        ))}
      </div>
    ) : null;

  return (
    <div className="relative shrink-0" ref={buttonRef}>
      <button
        type="button"
        onClick={() => {
          if (!open) updateMenuPosition();
          setOpen((v) => !v);
        }}
        className="inline-flex items-center gap-1 text-hos-text-secondary text-sm hover:text-hos-gold transition-colors duration-200 whitespace-nowrap"
        aria-expanded={open}
        aria-haspopup="true"
      >
        More
        <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {menuMarkup ? createPortal(menuMarkup, document.body) : null}
    </div>
  );
}
