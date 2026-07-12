import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LandingShell } from '../components/LandingShell';
import { LandingFooter } from '../components/LandingFooter';
import { FoundingMemberForm } from '../components/FoundingMemberForm';
import { landingPageMetadata } from '../lib/landingMetadata';
import { LANDING_LOGO, LANDING_WORDMARK } from '../lib/constants';
import { isFoundingMembersEnabled } from '../lib/foundingMembersConfig';
import { fetchFandomsFromUniverses } from '../lib/universesApi';

export const metadata: Metadata = landingPageMetadata({
  title: 'Register — Founding Members | House of Spells',
  description:
    'Register as a founding member of House of Spells — Times Square. Choose your fandoms and help shape what we stock.',
  path: '/founding-members',
});

export default async function FoundingMembersPage() {
  const registrationOpen = await isFoundingMembersEnabled();
  const fandoms = await fetchFandomsFromUniverses();

  return (
    <LandingShell nav="register" mainId="pg-register">
      <main id="pg-register" className="hos-page" tabIndex={-1}>
        <div className="reg-intro rv">
          <div className="hos-lockup intro-lockup" role="img" aria-label="House of Spells">
            <img className="reg-intro-logo" src={LANDING_LOGO} width={100} height={100} alt="" aria-hidden="true" />
            <img className="hos-wordmark-img" src={LANDING_WORDMARK} width={1024} height={258} alt="" aria-hidden="true" />
          </div>
          <p className="eyebrow">Founding Members</p>
          <h2 className="sec-h2">Enter the Circle</h2>
          <p className="sec-sub">
            Tell us your universe. Shape our inventory. Be among the first summoned when the gates of House of Spells open
            in Times Square.
          </p>
        </div>

        <Suspense fallback={<div style={{ minHeight: 400 }} />}>
          <FoundingMemberForm registrationOpen={registrationOpen} fandoms={fandoms} />
        </Suspense>

        <div style={{ height: 80 }} />
        <LandingFooter />
      </main>
    </LandingShell>
  );
}
