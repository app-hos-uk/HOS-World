export type MarketCode = 'US' | 'MY';

export interface MarketConfig {
  code: MarketCode;
  country: string;
  currency: string;
  currencySymbol: string;
  locale: string;
  timezone: string;
  siteUrl: string;
  shopUrl: string;
  apiUrl: string;
  store: {
    name: string;
    location: string;
    address: string;
    addressLine2?: string;
    city: string;
    state?: string;
    postalCode: string;
    countryName: string;
    phone: string;
    geo: { lat: number; lng: number };
  };
  socials: Array<{ label: string; href: string }>;
  /** Extra profiles that belong in structured data, not the footer icon row. */
  directoryLinks?: string[];
  socialHandleSuffix: string;
  hero: {
    locationLine: string;
    cityLine: string;
    statCell: string;
    statLabel: string;
  };
  foundingMember: {
    defaultCountry: string;
    phonePlaceholder: string;
    spendBrackets: string[];
    referralSources: string[];
    successMessage: string;
  };
  privacy: {
    entityName: string;
    jurisdiction: string;
    cmsSlug: string;
    website: string;
  };
  structuredData: {
    storeName: string;
    streetAddress: string;
    locality: string;
    region?: string;
    postalCode: string;
    country: string;
    currencyCode: string;
  };
  experience: {
    flagshipText: string;
  };
  launchDate?: string;
  launchTimezone?: string;
  /** Shown instead of a dated countdown when the venue has no public opening time. */
  comingSoonLine?: string;
}

const US_CONFIG: MarketConfig = {
  code: 'US',
  country: 'United States',
  currency: 'USD',
  currencySymbol: '$',
  locale: 'en-US',
  timezone: 'America/New_York',
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://us.houseofspells.com',
  shopUrl: process.env.NEXT_PUBLIC_SHOP_URL || 'https://shop.houseofspells.com',
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'https://api.houseofspells.com/api',
  store: {
    name: 'House of Spells — Times Square',
    location: 'Times Square, New York',
    address: '234 West 42nd Street',
    addressLine2: 'Between 7th & 8th Avenues',
    city: 'New York',
    state: 'NY',
    postalCode: '10036',
    countryName: 'United States',
    phone: '+1 (332) 250-4251',
    geo: { lat: 40.7563, lng: -73.989 },
  },
  socials: [
    { label: 'Instagram', href: 'https://www.instagram.com/houseofspellsnyc' },
    { label: 'TikTok', href: 'https://www.tiktok.com/@houseofspellsnyc' },
    { label: 'Facebook', href: 'https://www.facebook.com/HouseofspellsNYC' },
    { label: 'Threads', href: 'https://www.threads.net/@houseofspellsnyc' },
  ],
  directoryLinks: [
    'https://www.tripadvisor.com/Attraction_Review-g60763-d34352984-Reviews-House_of_Spells_Time_square-New_York_City_New_York.html',
  ],
  socialHandleSuffix: 'nyc',
  hero: {
    locationLine: 'Times Square',
    cityLine: 'New York',
    statCell: 'NYC',
    statLabel: 'Next Destination',
  },
  foundingMember: {
    defaultCountry: 'United States',
    phonePlaceholder: '+1 (000) 000-0000',
    spendBrackets: ['Under $25', '$25 – $75', '$75 – $150', '$150 – $300', '$300+'],
    referralSources: [
      'QR Code / Flyer',
      'Instagram',
      'TikTok',
      'Friend / Word of Mouth',
      'House Of Spells',
      'House Of Spells UK',
      'Times Square Ad',
      'Google Search',
      'Other',
    ],
    successMessage:
      "Your place in the circle is claimed. We'll summon you when the gates open in Times Square.",
  },
  privacy: {
    entityName: 'House of Spells USA',
    jurisdiction: 'United States',
    cmsSlug: 'privacy-policy-usa',
    website: 'houseofspells.com',
  },
  structuredData: {
    storeName: 'House of Spells — Times Square',
    streetAddress: '234 West 42nd Street',
    locality: 'New York',
    region: 'NY',
    postalCode: '10036',
    country: 'US',
    currencyCode: 'USD',
  },
  experience: {
    flagshipText:
      "50 million visitors pass through Times Square every year. We're planting the House of Spells flag at the very centre of that energy — a flagship for every fan on Earth.",
  },
  launchDate: '2026-07-29T10:00:00',
  launchTimezone: 'America/New_York',
};

const MY_CONFIG: MarketConfig = {
  code: 'MY',
  country: 'Malaysia',
  currency: 'MYR',
  currencySymbol: 'RM',
  locale: 'en-MY',
  timezone: 'Asia/Kuala_Lumpur',
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://houseofspells.my',
  shopUrl: process.env.NEXT_PUBLIC_SHOP_URL || 'https://shop.houseofspells.my',
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'https://api.houseofspells.com/api',
  store: {
    name: 'House of Spells — Malaysia',
    location: 'Kuala Lumpur, Malaysia',
    address: 'TBD',
    city: 'Kuala Lumpur',
    postalCode: '50000',
    countryName: 'Malaysia',
    phone: '+60 3-0000-0000',
    geo: { lat: 3.139, lng: 101.6869 },
  },
  socials: [
    { label: 'Instagram', href: 'https://www.instagram.com/houseofspellsmy' },
    { label: 'TikTok', href: 'https://www.tiktok.com/@houseofspellsmy' },
    { label: 'Facebook', href: 'https://www.facebook.com/HouseofspellsMY' },
  ],
  socialHandleSuffix: 'my',
  hero: {
    locationLine: 'Kuala Lumpur',
    cityLine: 'Malaysia',
    statCell: 'KL',
    statLabel: 'Coming Soon',
  },
  foundingMember: {
    defaultCountry: 'Malaysia',
    phonePlaceholder: '+60 12-345 6789',
    spendBrackets: ['Under RM25', 'RM25 – RM75', 'RM75 – RM150', 'RM150 – RM300', 'RM300+'],
    referralSources: [
      'QR Code / Flyer',
      'Instagram',
      'TikTok',
      'Friend / Word of Mouth',
      'House Of Spells',
      'House Of Spells UK',
      'Google Search',
      'Other',
    ],
    successMessage:
      "Your place in the circle is claimed. We'll summon you when the gates open in Kuala Lumpur.",
  },
  privacy: {
    entityName: 'House of Spells Malaysia',
    jurisdiction: 'Malaysia',
    cmsSlug: 'privacy-policy-malaysia',
    website: 'houseofspells.my',
  },
  structuredData: {
    storeName: 'House of Spells — Malaysia',
    streetAddress: 'TBD',
    locality: 'Kuala Lumpur',
    postalCode: '50000',
    country: 'MY',
    currencyCode: 'MYR',
  },
  experience: {
    flagshipText:
      "Kuala Lumpur is where the region comes together. We're planting the House of Spells flag in the heart of the city — a flagship for every fan in Malaysia.",
  },
  comingSoonLine: 'Coming to Malaysia this November',
};

const CONFIGS: Record<string, MarketConfig> = { US: US_CONFIG, MY: MY_CONFIG };

export function getMarketConfig(): MarketConfig {
  const code = (process.env.NEXT_PUBLIC_MARKET_CODE || 'US').toUpperCase();
  return CONFIGS[code] || US_CONFIG;
}

export const marketConfig = getMarketConfig();

/** True once the market's grand opening instant has passed. */
export function venueIsOpen(config: MarketConfig = marketConfig, now = Date.now()): boolean {
  if (config.comingSoonLine) return false;
  const instant = launchInstantMs(config);
  if (instant == null) return true;
  return now >= instant;
}

/** Wall-clock `launchDate` in `launchTimezone`, as a UTC epoch millisecond. */
export function launchInstantMs(config: MarketConfig = marketConfig): number | null {
  if (!config.launchDate || !config.launchTimezone) return null;
  return zonedLocalToUtcMs(config.launchDate, config.launchTimezone);
}

/** "July 29, 2026 · 10:00 AM EDT" */
export function formatLaunchLabel(config: MarketConfig = marketConfig): string {
  const parts = readLaunchParts(config);
  if (!parts) return '';
  return `${parts.month} ${parts.day}, ${parts.year} · ${parts.hour}:${parts.minute} ${parts.dayPeriod} ${parts.timeZoneName}`;
}

/** "Grand Launch · July 29 · 10:00 AM EDT" */
export function grandLaunchTicker(config: MarketConfig = marketConfig): string {
  if (config.comingSoonLine) return config.comingSoonLine;
  const parts = readLaunchParts(config);
  if (!parts) return `${config.hero.locationLine} · ${config.hero.cityLine}`;
  return `Grand Launch · ${parts.month} ${parts.day} · ${parts.hour}:${parts.minute} ${parts.dayPeriod} ${parts.timeZoneName}`;
}

export function formatStoreStreet(store: MarketConfig['store']): string {
  const locality = store.state
    ? `${store.city}, ${store.state} ${store.postalCode}`
    : `${store.city} ${store.postalCode}, ${store.countryName}`;
  return `${store.address}, ${locality}`;
}

export function storeMapsUrl(store: MarketConfig['store']): string {
  const query = ['House of Spells', store.address, store.city, store.state, store.postalCode]
    .filter(Boolean)
    .join(' ');
  return `https://maps.google.com/?q=${query.replace(/ /g, '+')}`;
}

export function phoneTelHref(phone: string): string {
  const compact = phone.replace(/[^\d+]/g, '');
  return `tel:${compact.startsWith('+') ? compact : `+${compact}`}`;
}

export function marketSameAs(config: MarketConfig = marketConfig): string[] {
  return [...config.socials.map((social) => social.href), ...(config.directoryLinks ?? []), config.shopUrl].filter(
    Boolean,
  );
}

function zonedLocalToUtcMs(localIso: string, timeZone: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(localIso);
  if (!match) return Date.parse(localIso);

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] || 0);
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(new Date(utcGuess));
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(
    pick('year'),
    pick('month') - 1,
    pick('day'),
    pick('hour'),
    pick('minute'),
    pick('second'),
  );
  return utcGuess - (asUtc - utcGuess);
}

function readLaunchParts(config: MarketConfig): {
  month: string;
  day: string;
  year: string;
  hour: string;
  minute: string;
  dayPeriod: string;
  timeZoneName: string;
} | null {
  const instant = launchInstantMs(config);
  if (instant == null || !config.launchTimezone) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: config.launchTimezone,
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  }).formatToParts(new Date(instant));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return {
    month: get('month'),
    day: get('day'),
    year: get('year'),
    hour: get('hour'),
    minute: get('minute'),
    dayPeriod: get('dayPeriod'),
    timeZoneName: get('timeZoneName'),
  };
}
