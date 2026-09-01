'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  captureInfluencerReferralFromQuery,
  isValidInfluencerReferralCode,
  stashReferralFromQuery,
  isValidProgramReferralCode,
} from '@/lib/referralAttribution';

/**
 * Global ?ref= capture for shared referral links.
 * Influencer codes → trackReferral + localStorage (commission attribution).
 * Loyalty / partner codes (HOS-*, PARTNER-*) → session stash (cookie set in middleware on /ref/[code]).
 */
export function ReferralCapture() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    const ref = searchParams.get('ref')?.trim();
    if (!ref) return;

    const key = `${pathname}:${ref}`;
    if (handledRef.current === key) return;
    handledRef.current = key;

    if (isValidProgramReferralCode(ref)) {
      stashReferralFromQuery(ref);
      return;
    }

    if (isValidInfluencerReferralCode(ref)) {
      void captureInfluencerReferralFromQuery(ref, pathname || undefined);
    }
  }, [searchParams, pathname]);

  return null;
}
