'use client';

import { useEffect } from 'react';

/** Loads a Google Font stylesheet so `fontFamily` in inline styles takes effect (font files must be fetched). */
export function GoogleFontLink({ family }: { family: string | undefined }) {
  useEffect(() => {
    const name = family?.trim();
    if (!name) return;
    const id = `google-font-${name.replace(/[^a-zA-Z0-9]+/g, '-')}`;
    if (document.getElementById(id)) return;
    const href = `https://fonts.googleapis.com/css2?family=${name.replace(/\s+/g, '+')}:wght@400;500;600;700&display=swap`;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
    return () => {
      const el = document.getElementById(id);
      if (el) el.remove();
    };
  }, [family]);

  return null;
}
