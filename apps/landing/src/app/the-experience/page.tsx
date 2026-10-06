import type { Metadata } from 'next';
import Link from 'next/link';
import { LandingShell } from '../components/LandingShell';
import { LandingFooter } from '../components/LandingFooter';
import { TimesSquareCanvas } from '../components/TimesSquareCanvas';
import { landingPageMetadata } from '../lib/landingMetadata';
import { getMarketConfig } from '../lib/marketConfig';
import { LANDING_REGISTER_PATH } from '../lib/constants';

export const metadata: Metadata = landingPageMetadata({
  title: 'The Experience — House of Spells',
  description: `House of Spells in ${getMarketConfig().hero.locationLine} — immersive zones, collectibles, events, and fan-curated inventory. The global flagship experience.`,
  path: '/the-experience',
});

const EXP_BLOCKS = [
  {
    num: '01',
    title: 'Immersive Universe Zones',
    text: 'Step inside your favourite worlds. Each zone is a fully realised environment — from the halls of Hogwarts to the streets of Gotham, the forests of Middle Earth to the galaxies of Star Wars.',
  },
  {
    num: '02',
    title: 'Exclusive Collectibles',
    text: "Rare, limited-edition merchandise you won't find anywhere else on Earth. Founding members get first access to the most sought-after items before doors even open.",
  },
  {
    num: '03',
    title: 'Live Fandom Events',
    text: "Screenings, signings, cosplay competitions, launch events, and community gatherings. The House is always alive — there's always something happening inside.",
  },
  {
    num: '04',
    title: 'Fan-Curated Inventory',
    text: 'Every shelf is shaped by you. Registrants\' fandom preferences directly determine what we stock — this is the first store ever built by the fans themselves.',
  },
];

export default function ExperiencePage() {
  const market = getMarketConfig();
  const blocks = [
    ...EXP_BLOCKS,
    {
      num: '05',
      title: market.store.location,
      text: market.experience.flagshipText,
    },
    {
      num: '06',
      title: 'The Global Launch',
      text: (
        <>
          <strong>House Of Spells</strong> is the global flagship story — our UK stores continue at{' '}
          <strong>House Of Spells UK</strong>. {market.hero.cityLine} is just the beginning. Register now to be part of day one.
        </>
      ),
    },
  ];

  return (
    <LandingShell nav="experience" mainId="pg-experience">
      <main id="pg-experience" className="hos-page" tabIndex={-1}>
        <div className="exp-intro rv">
          <p className="eyebrow">The Experience</p>
          <h2 className="sec-h2">
            {market.hero.locationLine}.
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
            <h3>{market.store.location}</h3>
            <p>The Global Flagship &nbsp;·&nbsp; Opening Soon</p>
          </div>
        </div>

        <div className="exp-blocks rv" style={{ marginBottom: 80 }}>
          {blocks.map((b) => (
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
