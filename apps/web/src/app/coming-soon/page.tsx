import Link from 'next/link';
import '../(landing)/landing.css';

const LOGO = '/assets/logo-emblem.png';
const WORDMARK = '/assets/logo-wordmark.png';
const REGISTER_PATH = '/founding-members';

export const metadata = {
  title: 'Coming Soon — House of Spells',
  description:
    'We are curating something extraordinary. Become a Founding Member to get early access when the House of Spells online shop launches.',
};

interface ComingSoonPageProps {
  searchParams: Promise<{ franchise?: string }>;
}

export default async function ComingSoonPage({ searchParams }: ComingSoonPageProps) {
  const params = await searchParams;
  const franchise = params.franchise?.trim();
  const hasFranchise = Boolean(franchise);

  const heading = hasFranchise ? franchise! : 'Curating Your Fandoms';
  const sub = hasFranchise
    ? (
        <>
          <strong>{franchise}</strong> is coming soon — we&apos;re hand-picking exclusive collectibles, merch
          &amp; memorabilia for this universe.
        </>
      )
    : (
        <>
          Our online shop is being prepared — hand-picking the finest collectibles, merch &amp; memorabilia from{' '}
          <em>every universe</em> you love.
        </>
      );

  return (
    <div className="landing-site coming-soon-shell">
      <div className="grain" aria-hidden="true" />
      <div className="vignette" aria-hidden="true" />

      <main className="cs-main">
        <div className="cs-brand">
          <img
            className="cs-logo"
            src={LOGO}
            width={140}
            height={140}
            alt=""
            aria-hidden="true"
          />
          <img
            className="cs-wordmark"
            src={WORDMARK}
            width={1024}
            height={258}
            alt="House of Spells"
          />
        </div>

        <div className="cs-rule" />

        {hasFranchise && <p className="cs-eyebrow">Coming Soon</p>}
        <h1 className="cs-heading">{heading}</h1>
        <p className="cs-sub">{sub}</p>

        <div className="cs-features">
          <div className="cs-feat">
            <span className="cs-feat-icon">&#9733;</span>
            <h3>Exclusive Collectibles</h3>
            <p>Rare finds from Marvel, Star Wars, DC, Naruto, Studio Ghibli &amp; beyond.</p>
          </div>
          <div className="cs-feat">
            <span className="cs-feat-icon">&#9830;</span>
            <h3>Founding Member Perks</h3>
            <p>Early access, special discounts &amp; a place in House of Spells history.</p>
          </div>
          <div className="cs-feat">
            <span className="cs-feat-icon">&#9812;</span>
            <h3>Times Square, NYC</h3>
            <p>A planet-scale fandom destination — online and in the heart of New York.</p>
          </div>
        </div>

        <div className="cs-cta">
          <Link href={REGISTER_PATH} className="btn-p">
            Become a Founding Member
          </Link>
          <Link href="/universes" className="btn-g">
            Explore Universes
          </Link>
        </div>

        <p className="cs-footnote">
          You&apos;ll be the first to know when the shop goes live.
        </p>
      </main>

      <footer className="cs-footer">
        <Link href="/">Home</Link>
        <span className="cs-dot">&middot;</span>
        <Link href="/universes">Universes</Link>
        <span className="cs-dot">&middot;</span>
        <Link href="/the-experience">The Experience</Link>
        <span className="cs-dot">&middot;</span>
        <Link href={REGISTER_PATH}>Register</Link>
      </footer>
    </div>
  );
}
