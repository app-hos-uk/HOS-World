'use client';

import Link from 'next/link';
import { useSiteSettings } from '@/contexts/SiteSettingsContext';
import { brandDisplayName } from '@/lib/siteSettingsDefaults';

/** Compact footer for cart/checkout — policies + copyright only */
export function MinimalCheckoutFooter() {
  const site = useSiteSettings();
  const brandName = brandDisplayName(site.platformName);

  return (
    <footer className="border-t border-hos-border bg-hos-bg mt-auto" role="contentinfo">
      <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-hos-text-muted">
        <p>© {new Date().getFullYear()} {brandName}. Secure checkout · Buyer protection on marketplace orders.</p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link href="/help" className="hover:text-hos-gold transition-colors">
            Help
          </Link>
          <Link href="/privacy-policy" className="hover:text-hos-gold transition-colors">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-hos-gold transition-colors">
            Terms
          </Link>
          <Link href="/refund-policy" className="hover:text-hos-gold transition-colors">
            Refunds
          </Link>
        </div>
      </div>
    </footer>
  );
}
