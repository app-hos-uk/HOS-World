import Link from 'next/link';
import { isValidLoyaltyReferralCode, isValidPartnerReferralCode } from '@/lib/referralAttribution';
import { getDirectApiBaseUrl } from '@/lib/apiBaseUrl';

type PartnerLandingInfo = {
  partner?: {
    name?: string;
    logoUrl?: string | null;
  };
  link?: {
    signupBonusPoints?: number | string | null;
    discountPercent?: number | string | null;
    pointsMultiplier?: number | string | null;
    multiplierDays?: number | string | null;
  };
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function fetchPartnerInfo(code: string): Promise<PartnerLandingInfo | null> {
  try {
    const res = await fetch(
      `${getDirectApiBaseUrl()}/partner-referrals/resolve/${encodeURIComponent(code)}`,
      { cache: 'no-store', headers: { Accept: 'application/json' } },
    );
    if (!res.ok) return null;
    const json: unknown = await res.json();
    const payload = asRecord(json);
    const data = asRecord(payload?.data) ?? payload;
    if (!data) return null;
    const partner = asRecord(data.partner);
    const link = asRecord(data.link) ?? asRecord(data.offer);
    if (!partner && !link) return null;
    return {
      partner: partner
        ? {
            name: partner.name != null ? String(partner.name) : undefined,
            logoUrl: partner.logoUrl != null ? String(partner.logoUrl) : null,
          }
        : undefined,
      link: link
        ? {
            signupBonusPoints: link.signupBonusPoints as number | string | null,
            discountPercent: link.discountPercent as number | string | null,
            pointsMultiplier: link.pointsMultiplier as number | string | null,
            multiplierDays: link.multiplierDays as number | string | null,
          }
        : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Loyalty / partner referral landing page.
 * Attribution cookie (`hos_ref`) is set in middleware — Server Components cannot
 * mutate cookies during render (Next.js restriction).
 */
export default async function ReferralLandingPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: raw } = await params;
  const code = decodeURIComponent(raw || '').trim();
  const showPartnerLanding = isValidPartnerReferralCode(code);
  const showLoyaltyLanding = !showPartnerLanding && isValidLoyaltyReferralCode(code);

  let partnerInfo: PartnerLandingInfo | null = null;
  if (showPartnerLanding) {
    partnerInfo = await fetchPartnerInfo(code);
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col items-center justify-center px-4">
      <h1 className="font-primary text-3xl text-amber-100 mb-4 text-center">The Enchanted Circle</h1>
      {showPartnerLanding ? (
        <>
          {partnerInfo?.partner?.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={partnerInfo.partner.logoUrl} alt={partnerInfo.partner.name ?? 'Partner'} className="h-16 mb-4" />
          )}
          <p className="font-secondary text-stone-400 text-center max-w-md mb-4">
            {partnerInfo?.partner?.name ? (
              <>
                Referred by <strong className="text-amber-200">{partnerInfo.partner.name}</strong>
              </>
            ) : (
              <>You have been invited to join House of Spells through a partner referral.</>
            )}
          </p>
          {num(partnerInfo?.link?.signupBonusPoints) > 0 && (
            <p className="font-secondary text-amber-300 text-center mb-2">
              Sign up and earn <strong>{num(partnerInfo?.link?.signupBonusPoints)} bonus points</strong>!
            </p>
          )}
          {num(partnerInfo?.link?.discountPercent) > 0 && (
            <p className="font-secondary text-amber-300 text-center mb-2">
              Get <strong>{num(partnerInfo?.link?.discountPercent)}% off</strong> your first order!
            </p>
          )}
          {num(partnerInfo?.link?.pointsMultiplier) > 1 && (
            <p className="font-secondary text-amber-300 text-center mb-2">
              Earn <strong>{num(partnerInfo?.link?.pointsMultiplier)}x points</strong> for {num(partnerInfo?.link?.multiplierDays)} days!
            </p>
          )}
          <div className="flex flex-wrap gap-3 justify-center mt-6">
            <Link
              href={`/register?ref=${encodeURIComponent(code)}`}
              className="rounded-md bg-amber-600 px-5 py-2.5 text-stone-950 font-secondary font-medium hover:bg-amber-500"
            >
              Sign up now
            </Link>
            <Link href="/" className="rounded-md border border-stone-600 px-5 py-2.5 font-secondary hover:bg-stone-900">
              Home
            </Link>
          </div>
        </>
      ) : showLoyaltyLanding ? (
        <>
          <p className="font-secondary text-stone-400 text-center max-w-md mb-8">
            You have been invited to join House of Spells loyalty. Create an account to earn bonus points when you shop.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              href={`/register?ref=${encodeURIComponent(code)}`}
              className="rounded-md bg-amber-600 px-5 py-2.5 text-stone-950 font-secondary font-medium hover:bg-amber-500"
            >
              Sign up
            </Link>
            <Link href="/" className="rounded-md border border-stone-600 px-5 py-2.5 font-secondary hover:bg-stone-900">
              Home
            </Link>
          </div>
          <p className="mt-8 text-xs text-stone-600 font-secondary">Referral saved for 30 days.</p>
        </>
      ) : (
        <>
          <p className="font-secondary text-stone-400 text-center max-w-md mb-8">
            This referral link is invalid or has an unrecognized code format.
          </p>
          <Link href="/" className="rounded-md border border-stone-600 px-5 py-2.5 font-secondary hover:bg-stone-900">
            Home
          </Link>
        </>
      )}
    </div>
  );
}
