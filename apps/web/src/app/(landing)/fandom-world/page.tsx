import type { Metadata } from 'next';
import Link from 'next/link';
import { LandingShell } from '../components/LandingShell';
import { LandingFooter } from '../components/LandingFooter';
import { FandomWorldBrowse } from '../components/FandomWorldBrowse';
import { landingPageMetadata } from '../lib/landingMetadata';
import { marketContent } from '../lib/marketContent';
import { fetchFandomWorldFeed, type FandomWorldItem } from '../lib/fandomWorldApi';
import { getSiteUrl } from '@/lib/siteUrls';
import { LANDING_LOGO, LANDING_REGISTER_PATH, LANDING_WORDMARK } from '../lib/constants';

export const revalidate = 60;

export const metadata: Metadata = landingPageMetadata({
  title: 'Fandom World — House of Spells',
  description: marketContent.fandomWorldDescription,
  path: '/fandom-world',
});

function buildStructuredData(items: FandomWorldItem[]) {
  const siteUrl = getSiteUrl();
  const graph: Record<string, unknown>[] = [
    {
      '@type': 'CollectionPage',
      name: 'Fandom World — House of Spells',
      description: marketContent.fandomWorldDescription,
      url: `${siteUrl}/fandom-world`,
      isPartOf: { '@type': 'WebSite', name: 'House of Spells', url: `${siteUrl}/` },
    },
  ];

  for (const item of items.slice(0, 10)) {
    if (item.type === 'news') {
      graph.push({
        '@type': 'NewsArticle',
        headline: item.title,
        ...(item.excerpt ? { description: item.excerpt } : {}),
        ...(item.imageUrl ? { image: item.imageUrl } : {}),
        datePublished: item.date,
        url: item.externalUrl || `${siteUrl}/fandom-world`,
        publisher: { '@type': 'Organization', name: item.sourceName || 'House of Spells' },
      });
    } else if (item.type === 'event') {
      graph.push({
        '@type': 'Event',
        name: item.title,
        ...(item.excerpt ? { description: item.excerpt } : {}),
        ...(item.imageUrl ? { image: item.imageUrl } : {}),
        startDate: item.date,
        ...(item.location ? { location: { '@type': 'Place', name: item.location } } : {}),
        organizer: { '@type': 'Organization', name: 'House of Spells' },
        url: item.slug ? `${siteUrl}/events/${item.slug}` : `${siteUrl}/fandom-world`,
      });
    }
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}

export default async function FandomWorldPage() {
  const items = await fetchFandomWorldFeed(48);

  return (
    <LandingShell nav="fandom" mainId="pg-fandom-world">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildStructuredData(items)) }}
      />
      <main id="pg-fandom-world" className="hos-page" tabIndex={-1}>
        <div className="page-hero rv">
          <div className="hos-lockup page-hero-lockup" role="img" aria-label="House of Spells">
            <img className="page-hero-logo" src={LANDING_LOGO} width={96} height={96} alt="" aria-hidden="true" />
            <img
              className="hos-wordmark-img"
              src={LANDING_WORDMARK}
              width={1024}
              height={258}
              alt=""
              aria-hidden="true"
            />
          </div>
          <p className="eyebrow">{marketContent.fandomWorldHeading}</p>
          <h1 className="sec-h2">{marketContent.fandomWorldSubtitle}</h1>
          <p className="sec-sub">{marketContent.fandomWorldDescription}</p>
        </div>

        <FandomWorldBrowse items={items} />

        <div className="landing-cta-row">
          <Link href="/" className="btn-g">
            Back to Home
          </Link>
          <Link href={LANDING_REGISTER_PATH} className="btn-p">
            Claim Your Place
          </Link>
        </div>

        <LandingFooter />
      </main>
    </LandingShell>
  );
}
