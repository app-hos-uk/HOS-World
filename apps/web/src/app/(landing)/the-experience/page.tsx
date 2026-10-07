import type { Metadata } from 'next';
import Link from 'next/link';
import { LandingShell } from '../components/LandingShell';
import { LandingFooter } from '../components/LandingFooter';
import { TimesSquareCanvas } from '../components/TimesSquareCanvas';
import { landingPageMetadata } from '../lib/landingMetadata';
import { marketContent } from '../lib/marketContent';
import { LANDING_REGISTER_PATH } from '../lib/constants';

export const metadata: Metadata = landingPageMetadata({
  title: 'The Experience — House of Spells',
  description: marketContent.experienceMetaDescription,
  path: '/the-experience',
});

const EXP_BLOCKS = marketContent.experienceBlocks;

export default function ExperiencePage() {
  return (
    <LandingShell nav="experience" mainId="pg-experience">
      <main id="pg-experience" className="hos-page" tabIndex={-1}>
        <div className="exp-intro rv">
          <p className="eyebrow">The Experience</p>
          <h2 className="sec-h2">
            {marketContent.experienceHeading[0]}
            <br />
            {marketContent.experienceHeading[1]}
          </h2>
          <p className="sec-sub">
            {marketContent.experienceIntroSub}
          </p>
        </div>

        <div className="ts-visual rv">
          <TimesSquareCanvas />
          <div className="ts-overlay" />
          <div className="ts-label">
            <h3>{marketContent.location}</h3>
            <p>{marketContent.experienceVisualLabel}</p>
          </div>
        </div>

        <div className="exp-blocks rv" style={{ marginBottom: 80 }}>
          {EXP_BLOCKS.map((b) => (
            <div key={b.num} className="exp-block">
              <div className="exp-block-num">{b.num}</div>
              <h3>{b.title}</h3>
              <p>{b.text}</p>
            </div>
          ))}
        </div>

        <div className="landing-cta-row landing-cta-row--tight">
          <Link href={LANDING_REGISTER_PATH} className="btn-p">
            Register Now — Shape What We Build
          </Link>
        </div>

        <LandingFooter />
      </main>
    </LandingShell>
  );
}
