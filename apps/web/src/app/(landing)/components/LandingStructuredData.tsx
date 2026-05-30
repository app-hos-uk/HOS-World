const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://hos-marketplaceweb-production.up.railway.app';

export function LandingStructuredData() {
  const graph = [
    {
      '@type': 'Organization',
      name: 'House of Spells',
      url: `${SITE_URL}/`,
      logo: `${SITE_URL}/landing/hos-logo.jpg`,
      sameAs: [
        'https://www.instagram.com/houseofspells/',
        'https://www.houseofspells.co.uk/',
      ],
    },
    {
      '@type': 'WebSite',
      name: 'House of Spells',
      url: `${SITE_URL}/`,
      description: 'Multi-fandom flagship opening in Times Square, New York.',
      publisher: {
        '@type': 'Organization',
        name: 'House of Spells',
      },
    },
  ];

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }),
      }}
    />
  );
}
