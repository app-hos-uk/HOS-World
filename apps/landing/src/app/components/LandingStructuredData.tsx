import { getSiteUrl } from '../../lib/siteUrls';
import { getMarketConfig, marketSameAs, storeMapsUrl, venueIsOpen } from '../lib/marketConfig';

export function LandingStructuredData() {
  if (process.env.NEXT_PUBLIC_SITE_ROLE === 'hub') {
    const organizationSchema = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'House of Spells',
      alternateName: "Earth's Multi-Fandom Universe",
      url: 'https://houseofspells.com',
      sameAs: [
        'https://www.houseofspells.co.uk',
        'https://us.houseofspells.com',
        'https://houseofspells.my',
        'https://shop.houseofspells.com',
      ],
    };

    return (
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationSchema),
        }}
      />
    );
  }

  const market = getMarketConfig();
  const siteUrl = getSiteUrl();
  const place = market.structuredData;
  const open = venueIsOpen(market);
  const storeSchema = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: place.storeName,
    alternateName: 'House of Spells',
    slogan: "Earth's Multi-Fandom Universe",
    description: `House of Spells is Earth's Multi-Fandom Universe — an immersive fandom experience destination in ${market.store.location}, celebrating Marvel, Star Wars, Game of Thrones, the Wizarding World, anime, gaming and more.`,
    url: siteUrl,
    image: `${siteUrl}/assets/logo-emblem.png`,
    logo: `${siteUrl}/assets/logo-emblem.png`,
    ...(open ? { telephone: market.store.phone } : {}),
    address: {
      '@type': 'PostalAddress',
      streetAddress: place.streetAddress,
      addressLocality: place.locality,
      addressRegion: place.region,
      postalCode: place.postalCode,
      addressCountry: place.country,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: market.store.geo.lat,
      longitude: market.store.geo.lng,
    },
    ...(open
      ? {
          hasMap: storeMapsUrl(market.store),
          openingHoursSpecification: [
            {
              '@type': 'OpeningHoursSpecification',
              dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
              opens: '10:00',
              closes: '24:00',
            },
          ],
        }
      : {}),
    priceRange: '$$',
    currenciesAccepted: place.currencyCode,
    paymentAccepted: 'Cash, Credit Card, Debit Card, Contactless',
    sameAs: marketSameAs(market),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(storeSchema),
      }}
    />
  );
}
