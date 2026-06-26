'use client';

import { useEffect } from 'react';

const KNOWN_GOOGLE_FONTS = new Set([
  'Inter',
  'Roboto',
  'Open Sans',
  'Lato',
  'Montserrat',
  'Poppins',
  'Raleway',
  'Playfair Display',
  'Merriweather',
  'Oswald',
  'Nunito',
  'Source Sans 3',
  'Cormorant Garamond',
  'Figtree',
]);

/** Letters, digits, and spaces only — prevents URL injection in Google Fonts href. */
const SAFE_FONT_FAMILY_RE = /^[a-zA-Z0-9 ]+$/;

function sanitizeFontFamily(family: string | undefined): string | null {
  const name = family?.trim();
  if (!name || !SAFE_FONT_FAMILY_RE.test(name)) return null;
  if (!KNOWN_GOOGLE_FONTS.has(name)) return null;
  return name;
}

/** Loads a Google Font stylesheet so `fontFamily` in inline styles takes effect (font files must be fetched). */
export function GoogleFontLink({ family }: { family: string | undefined }) {
  useEffect(() => {
    const name = sanitizeFontFamily(family);
    if (!name) return;
    const id = `google-font-${name.replace(/\s+/g, '-')}`;
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
