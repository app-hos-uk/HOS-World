import type { Metadata } from 'next';
import Link from 'next/link';
import { LandingShell } from '../components/LandingShell';
import { LandingFooter } from '../components/LandingFooter';
import { UniverseGrid } from '../components/UniverseGrid';
import { landingPageMetadata } from '../lib/landingMetadata';
import { LANDING_LOGO, LANDING_REGISTER_PATH, LANDING_WORDMARK } from '../lib/constants';

export const metadata: Metadata = landingPageMetadata({
  title: 'Universes — House of Spells',
  description:
    'Explore every universe at House of Spells — Marvel, Star Wars, DC, Middle Earth, Wizarding World, Naruto, and more. Times Square, New York.',
  path: '/universes',
});

export default function UniversesPage() {
  return (
    <LandingShell nav="universes" mainId="pg-universes">
      <main id="pg-universes" className="hos-page" tabIndex={-1}>
        <div className="page-hero rv">
          <div className="hos-lockup page-hero-lockup" role="img" aria-label="House of Spells">
            <img className="page-hero-logo" src={LANDING_LOGO} width={96} height={96} alt="" aria-hidden="true" />
            <img className="hos-wordmark-img" src={LANDING_WORDMARK} width={1024} height={258} alt="" aria-hidden="true" />
          </div>
          <p className="eyebrow">The Multiverse</p>
          <h2 className="sec-h2">
            Every Universe Has
            <br />a Home Here
          </h2>
          <p className="sec-sub">
            From galaxies far away to kingdoms forged in fire. House of Spells holds them all — explore every universe we
            celebrate.
          </p>
        </div>

        <UniverseGrid />

        <div className="landing-cta-row">
          <Link href={LANDING_REGISTER_PATH} className="btn-p">
            Claim Your Place
          </Link>
          <Link href="/the-experience" className="btn-g">
            The Experience
          </Link>
        </div>

        <LandingFooter />
      </main>
    </LandingShell>
  );
}
