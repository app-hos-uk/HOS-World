import type { Metadata } from 'next';
import Link from 'next/link';
import { LandingShell } from '../components/LandingShell';
import { LandingFooter } from '../components/LandingFooter';
import { TimesSquareCanvas } from '../components/TimesSquareCanvas';
import { landingPageMetadata } from '../lib/landingMetadata';
import { LANDING_LOGO, LANDING_REGISTER_PATH, LANDING_WORDMARK } from '../lib/constants';

export const metadata: Metadata = landingPageMetadata({
  title: 'The Experience — House of Spells',
  description:
    'House of Spells in Times Square — immersive zones, collectibles, events, and fan-curated inventory. The global flagship experience.',
  path: '/the-experience',
});

const EXP_BLOCKS = [
  {
    num: '01',
    icon: '🌌',
    title: 'Immersive Universe Zones',
    text: 'Step inside your favourite worlds. Each zone is a fully realised environment — from the halls of Hogwarts to the streets of Gotham, the forests of Middle Earth to the galaxies of Star Wars.',
  },
  {
    num: '02',
    icon: '🏆',
    title: 'Exclusive Collectibles',
    text: "Rare, limited-edition merchandise you won't find anywhere else on Earth. Founding members get first access to the most sought-after items before doors even open.",
  },
  {
    num: '03',
    icon: '🎭',
    title: 'Live Fandom Events',
    text: "Screenings, signings, cosplay competitions, launch events, and community gatherings. The House is always alive — there's always something happening inside.",
  },
  {
    num: '04',
    icon: '🔮',
    title: 'Fan-Curated Inventory',
    text: 'Every shelf is shaped by you. Registrants\' fandom preferences directly determine what we stock — this is the first store ever built by the fans themselves.',
  },
  {
    num: '05',
    icon: '📍',
    title: 'Times Square, New York',
    text: "50 million visitors pass through Times Square every year. We're planting the House of Spells flag at the very centre of that energy — a flagship for every fan on Earth.",
  },
  {
    num: '06',
    icon: '🌐',
    title: 'The Global Launch',
    text: (
      <>
        <strong>houseofspells.com</strong> is the global flagship story — the UK store lives on at{' '}
        <strong>houseofspells.co.uk</strong>. New York is just the beginning. Register now to be part of day one.
      </>
    ),
  },
];

export default function ExperiencePage() {
  return (
    <LandingShell nav="experience" mainId="pg-experience">
      <main id="pg-experience" className="hos-page" tabIndex={-1}>
        <div className="exp-intro rv">
          <div className="hos-lockup intro-lockup" role="img" aria-label="House of Spells">
            <img className="exp-intro-logo" src={LANDING_LOGO} width={100} height={100} alt="" aria-hidden="true" />
            <img className="hos-wordmark-img" src={LANDING_WORDMARK} width={1024} height={258} alt="" aria-hidden="true" />
          </div>
          <p className="eyebrow">The Experience</p>
          <h2 className="sec-h2">
            Times Square.
            <br />
            The World&apos;s Stage.
          </h2>
          <p className="sec-sub">
            House of Spells is bringing the most ambitious multi-fandom experience centre ever built to the crossroads of
            the world.
          </p>
        </div>

        <div className="ts-visual rv">
          <TimesSquareCanvas />
          <div className="ts-overlay" />
          <div className="ts-label">
            <h3>Times Square, New York</h3>
            <p>The Global Flagship &nbsp;·&nbsp; Opening Soon</p>
          </div>
        </div>

        <div className="exp-blocks rv" style={{ marginBottom: 80 }}>
          {EXP_BLOCKS.map((b) => (
            <div key={b.num} className="exp-block">
              <div className="exp-block-num">{b.num}</div>
              <span className="exp-block-icon">{b.icon}</span>
              <h3>{b.title}</h3>
              <p>{b.text}</p>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', padding: '0 24px 80px' }}>
          <Link href={LANDING_REGISTER_PATH} className="btn-p">
            ✦ &nbsp;Register Now — Shape What We Build
          </Link>
        </div>

        <LandingFooter />
      </main>
    </LandingShell>
  );
}
