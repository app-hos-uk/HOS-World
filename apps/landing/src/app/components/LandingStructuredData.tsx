import { getSiteUrl } from '../../lib/siteUrls';

const SITE_URL = getSiteUrl();

export function LandingStructuredData() {
  const storeSchema = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: 'House of Spells — Times Square',
    alternateName: 'House of Spells',
    slogan: "Earth's Multi-Fandom Universe",
    description:
      "House of Spells is Earth's Multi-Fandom Universe — an immersive multi-fandom experience centre in Times Square, New York, celebrating Marvel, Star Wars, Game of Thrones, the Wizarding World, anime, gaming and more.",
    url: SITE_URL,
    image: `${SITE_URL}/assets/logo-emblem.png`,
    logo: `${SITE_URL}/assets/logo-emblem.png`,
    telephone: '+1-332-250-4251',
    address: {
      '@type': 'PostalAddress',
      streetAddress: '234 West 42nd Street',
      addressLocality: 'New York',
      addressRegion: 'NY',
      postalCode: '10036',
      addressCountry: 'US',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 40.7563,
      longitude: -73.989,
    },
    hasMap:
      'https://maps.google.com/?q=House+of+Spells+234+West+42nd+Street+New+York+NY+10036',
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        opens: '10:00',
        closes: '23:59',
      },
    ],
    priceRange: '$$',
    currenciesAccepted: 'USD',
    paymentAccepted: 'Cash, Credit Card, Debit Card, Contactless',
    sameAs: [
      'https://www.instagram.com/houseofspellsnyc',
      'https://www.tiktok.com/@houseofspellsnyc',
      'https://www.facebook.com/HouseofspellsNYC',
      'https://www.threads.net/@houseofspellsnyc',
      'https://www.tripadvisor.com/Attraction_Review-g60763-d34352984-Reviews-House_of_Spells_Time_square-New_York_City_New_York.html',
      'https://shop.houseofspells.com',
    ],
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
