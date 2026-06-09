export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() || '';

export function isMetaPixelEnabled(): boolean {
  return Boolean(META_PIXEL_ID);
}

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: (...args: unknown[]) => void;
  }
}

export function getFbq(): ((...args: unknown[]) => void) | null {
  if (typeof window === 'undefined') return null;
  return typeof window.fbq === 'function' ? window.fbq : null;
}
