import { getSiteUrl } from '@/lib/siteUrls';
import { marketContent } from '../lib/marketContent';

const SITE_URL = getSiteUrl();

export function LandingStructuredData() {
  const store = marketContent.store;
  const graph: Record<string, unknown>[] = [
    {
      '@type': 'Organization',
      name: 'House of Spells',
      url: `${SITE_URL}/`,
      logo: `${SITE_URL}/assets/logo-emblem.png`,
      sameAs: [
        ...marketContent.socials.map((s) => s.href),
        'https://www.houseofspells.co.uk/',
      ],
    },
    {
      '@type': 'WebSite',
      name: 'House of Spells',
      url: `${SITE_URL}/`,
      description: marketContent.structuredDataDescription,
      publisher: {
        '@type': 'Organization',
        name: 'House of Spells',
      },
    },
  ];

  if (store) {
    graph.push({
      '@type': ['Store', 'LocalBusiness'],
      name: store.name,
      description: marketContent.structuredDataDescription,
      url: `${SITE_URL}/`,
      telephone: store.phone,
      address: {
        '@type': 'PostalAddress',
        streetAddress: store.address,
        addressLocality: store.city,
        ...(store.state ? { addressRegion: store.state } : {}),
        postalCode: store.postalCode,
        addressCountry: store.countryName,
      },
      openingHours: 'Mo-Su 10:00-00:00',
      image: `${SITE_URL}/assets/logo-emblem.png`,
      sameAs: marketContent.socials.map((s) => s.href),
    });
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }),
      }}
    />
  );
}
