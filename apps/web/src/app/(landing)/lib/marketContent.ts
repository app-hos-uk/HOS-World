/**
 * Market-specific content for the web app's landing pages.
 * Driven by NEXT_PUBLIC_MARKET_CODE — mirrors apps/landing marketConfig.ts.
 */

export interface MarketContent {
  /** 'pre-launch' while venue is unannounced/upcoming, 'live' once doors are open */
  phase: 'pre-launch' | 'live';
  /** ISO 8601 local datetime of grand opening (e.g. "2026-07-29T10:00:00") */
  launchDate?: string;
  /** IANA timezone for the launch date */
  launchTimezone?: string;
  /** e.g. "Times Square, New York" / "Kuala Lumpur, Malaysia" */
  location: string;
  /** e.g. "Times Square" / "Kuala Lumpur" */
  locationShort: string;
  /** e.g. "New York" / "Malaysia" */
  cityOrCountry: string;
  /** e.g. "NYC" / "KL" */
  cityCode: string;
  /** e.g. "Next Destination" / "Coming Soon" */
  statLabel: string;
  /** Hero banner text */
  announcementBanner: string;
  /** Manifesto closing paragraph */
  manifestoClosing: string;
  /** Founding-member intro */
  foundingMemberIntro: string;
  /** Success message after founding-member registration */
  successMessage: string;
  /** "The Experience" page heading (two-line) */
  experienceHeading: [string, string];
  /** "The Experience" page intro subtitle */
  experienceIntroSub: string;
  /** Experience block 05 — the flagship location block */
  experienceFlagship: { title: string; text: string };
  /** All six numbered experience blocks */
  experienceBlocks: { num: string; title: string; text: string }[];
  /** Label under the visual */
  experienceVisualLabel: string;
  /** Phone input placeholder */
  phonePlaceholder: string;
  /** Spend-bracket <option> labels */
  spendBrackets: string[];
  /** "How did you find us?" <option> labels */
  referralSources: string[];
  /** Ticker marquee items */
  tickerItems: string[];
  /** Footer location line */
  footerLocation: string;
  /** Physical venue details (populated when phase=live) */
  store?: {
    name: string;
    address: string;
    addressLine2?: string;
    city: string;
    state?: string;
    postalCode: string;
    countryName: string;
    phone: string;
    hours: string;
    mapsQuery: string;
  };
  /** Social-media profile URLs */
  socials: { label: string; href: string }[];
  /** Schema.org structured-data description */
  structuredDataDescription: string;
  /** Metadata description for the layout / homepage */
  siteDescription: string;
  /** Metadata description for the founding-members page */
  foundingMembersMetaDescription: string;
  /** Metadata description for the experience page */
  experienceMetaDescription: string;
  /** Metadata description for the universes page */
  universesMetaDescription: string;
  /** Coming-soon feature card — location label + subtitle */
  comingSoonFeature: { title: string; text: string };
  /** Fandom World section heading */
  fandomWorldHeading: string;
  /** Fandom World section subtitle */
  fandomWorldSubtitle: string;
  /** Fandom World section description */
  fandomWorldDescription: string;
}

const US_CONTENT: MarketContent = {
  phase: 'live',
  launchDate: '2026-07-29T10:00:00',
  launchTimezone: 'America/New_York',
  location: 'Times Square, New York',
  locationShort: 'Times Square',
  cityOrCountry: 'New York',
  cityCode: 'NYC',
  statLabel: 'Now Open',
  announcementBanner:
    'We\u2019re live in Times Square, New York',
  manifestoClosing:
    'Now House Of Spells brings that vision to the centre of the world — open now in Times Square, New York.',
  foundingMemberIntro:
    'Tell us your universe. Shape our inventory. Join the founding circle of House of Spells in Times Square.',
  successMessage:
    'Your place in the circle is claimed. Welcome to House of Spells — Times Square.',
  experienceHeading: ['Times Square.', "The World's Stage."],
  experienceIntroSub:
    'House of Spells has arrived — the most ambitious multi-fandom experience centre ever built, at the crossroads of the world.',
  experienceFlagship: {
    title: 'Times Square, New York',
    text: '50 million visitors pass through Times Square every year. House of Spells stands at the very centre of that energy — a flagship for every fan on Earth.',
  },
  experienceBlocks: [
    {
      num: '01',
      title: 'Immersive Universe Zones',
      text: 'Step inside your favourite worlds. Each zone is a fully realised environment — from the halls of Hogwarts to the streets of Gotham, the forests of Middle Earth to the galaxies of Star Wars.',
    },
    {
      num: '02',
      title: 'Exclusive Collectibles',
      text: "Rare, limited-edition merchandise you won't find anywhere else on Earth. Founding members get first access to the most sought-after drops.",
    },
    {
      num: '03',
      title: 'Live Fandom Events',
      text: "Screenings, signings, cosplay competitions, launch events, and community gatherings. The House is always alive — there's always something happening inside.",
    },
    {
      num: '04',
      title: 'Fan-Curated Inventory',
      text: 'Every shelf is shaped by you. Your fandom preferences directly determine what we stock — this is the first destination ever built by the fans themselves.',
    },
    {
      num: '05',
      title: 'Times Square, New York',
      text: '50 million visitors pass through Times Square every year. House of Spells stands at the very centre of that energy — a flagship for every fan on Earth.',
    },
    {
      num: '06',
      title: 'The Global Flagship',
      text: 'House Of Spells is the global flagship — our UK chapters continue at House Of Spells UK. New York is just the beginning. Visit us in Times Square or explore online.',
    },
  ],
  experienceVisualLabel: 'The Global Flagship · Now Open',
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
  tickerItems: [
    "Earth's Multi-Fandom Universe",
    'Grand Launch · July 29 · Times Square',
    'Marvel · Star Wars · DC Universe',
    'Naruto · Middle Earth · Studio Ghibli',
    'House Of Spells',
    'Every Universe. One Destination.',
    'Game of Thrones · Avatar · The Witcher',
    'Now Open in New York',
  ],
  footerLocation: 'Times Square, New York',
  store: {
    name: 'House of Spells — Times Square',
    address: '234 West 42nd Street',
    addressLine2: 'Between 7th & 8th Avenues',
    city: 'New York',
    state: 'NY',
    postalCode: '10036',
    countryName: 'United States',
    phone: '+1 (332) 250-4251',
    hours: 'Open Daily · 10:00 AM – Midnight',
    mapsQuery: 'House+of+Spells+234+West+42nd+Street+New+York+NY+10036',
  },
  socials: [
    { label: 'Instagram', href: 'https://www.instagram.com/houseofspellsnyc' },
    { label: 'TikTok', href: 'https://www.tiktok.com/@houseofspellsnyc' },
    { label: 'Facebook', href: 'https://www.facebook.com/HouseofspellsNYC' },
    { label: 'Threads', href: 'https://www.threads.net/@houseofspellsnyc' },
  ],
  structuredDataDescription:
    'Multi-fandom flagship now open in Times Square, New York. 50+ universes, 10,000+ products, exclusive collectibles, and live events.',
  siteDescription:
    'House of Spells — the multi-fandom flagship now open in Times Square, New York. Every universe. One destination. Shop online or visit us.',
  foundingMembersMetaDescription:
    'Join the founding circle of House of Spells — Times Square. Choose your fandoms and help shape what we stock.',
  experienceMetaDescription:
    'House of Spells in Times Square — immersive zones, collectibles, events, and fan-curated inventory. The global flagship experience, now open.',
  universesMetaDescription:
    'Explore every universe at House of Spells — Marvel, Star Wars, DC, Middle Earth, Wizarding World, Naruto, and more. Now open in Times Square, New York.',
  comingSoonFeature: {
    title: 'Times Square, NYC',
    text: 'A planet-scale fandom destination — online and in the heart of New York. Now open.',
  },
  fandomWorldHeading: 'Fandom World',
  fandomWorldSubtitle: 'Every Universe. Every Story.',
  fandomWorldDescription:
    'The latest from every universe — movie premieres, live events in Times Square, and stories from across the fandom world.',
};

const MY_CONTENT: MarketContent = {
  phase: 'pre-launch',
  location: 'Kuala Lumpur, Malaysia',
  locationShort: 'Kuala Lumpur',
  cityOrCountry: 'Malaysia',
  cityCode: 'KL',
  statLabel: 'Coming Soon',
  announcementBanner:
    'A grand launch in Kuala Lumpur, Malaysia — coming soon.',
  manifestoClosing:
    'Now House Of Spells brings that vision to Southeast Asia — opening in Kuala Lumpur, Malaysia.',
  foundingMemberIntro:
    'Tell us your universe. Shape our inventory. Be among the first summoned when the gates of House of Spells open in Kuala Lumpur.',
  successMessage:
    "Your place in the circle is claimed. We'll summon you when the gates open in Kuala Lumpur.",
  experienceHeading: ['Kuala Lumpur.', 'Where Fandoms Unite.'],
  experienceIntroSub:
    'Southeast Asia\'s first multi-fandom flagship — where anime, manga, Marvel, and every universe you love come together under one roof in the heart of KL.',
  experienceFlagship: {
    title: 'Kuala Lumpur, Malaysia',
    text: "Kuala Lumpur is where the region comes together. We're planting the House of Spells flag in the heart of the city — a flagship for every fan in Malaysia.",
  },
  experienceBlocks: [
    {
      num: '01',
      title: 'Asia\'s Multi-Fandom Destination',
      text: 'Southeast Asia has one of the most passionate fandom communities on Earth. House of Spells KL is built for you — a space where anime, manga, Western franchises, and regional favourites share the same stage for the first time.',
    },
    {
      num: '02',
      title: 'Anime, Manga & Beyond',
      text: 'From Naruto and One Piece to Dragon Ball and Studio Ghibli — plus Marvel, Star Wars, DC, and Middle Earth. House of Spells KL celebrates the universes Asia grew up with alongside the worlds it adopted.',
    },
    {
      num: '03',
      title: 'Exclusive Regional Collectibles',
      text: 'Limited-edition merchandise, Asia-exclusive figures, and rare finds sourced for the Southeast Asian market. Founding members get first access before the doors open.',
    },
    {
      num: '04',
      title: 'Cosplay, Events & Community',
      text: 'Malaysia is home to one of Asia\'s most vibrant cosplay scenes. House of Spells KL will host cosplay gatherings, screenings, launch events, and community meetups — a permanent home for fandom culture.',
    },
    {
      num: '05',
      title: 'Kuala Lumpur, Malaysia',
      text: "Kuala Lumpur is where the region comes together. We're planting the House of Spells flag in the heart of the city — a flagship for every fan in Malaysia and the wider ASEAN region.",
    },
    {
      num: '06',
      title: 'First in Southeast Asia',
      text: 'House of Spells launches in New York and Kuala Lumpur simultaneously — two flagship locations on opposite sides of the world. Malaysia is not a follow-on — it\'s a founding chapter. Register now to be part of day one.',
    },
  ],
  experienceVisualLabel: 'The Southeast Asia Flagship · Opening Soon',
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
  tickerItems: [
    "Earth's Multi-Fandom Universe",
    'Kuala Lumpur · Malaysia',
    'Marvel · Star Wars · DC Universe',
    'Naruto · Middle Earth · Studio Ghibli',
    'House Of Spells',
    'Every Universe. One Destination.',
    'Game of Thrones · Avatar · The Witcher',
    'Opening in Kuala Lumpur',
  ],
  footerLocation: 'Kuala Lumpur, Malaysia',
  socials: [
    { label: 'Instagram', href: 'https://www.instagram.com/houseofspellsmy/' },
    { label: 'TikTok', href: 'https://www.tiktok.com/@houseofspellsmy' },
    { label: 'Facebook', href: 'https://www.facebook.com/HouseofspellsMY' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/company/houseofspells/' },
  ],
  structuredDataDescription:
    'Multi-fandom flagship opening in Kuala Lumpur, Malaysia.',
  siteDescription:
    'House of Spells — the multi-fandom flagship opening in Kuala Lumpur, Malaysia. Every universe. One destination. Register for founding membership.',
  foundingMembersMetaDescription:
    'Register as a founding member of House of Spells — Kuala Lumpur. Choose your fandoms and help shape what we stock.',
  experienceMetaDescription:
    'House of Spells Kuala Lumpur — Southeast Asia\'s first multi-fandom flagship. Anime, manga, Marvel, collectibles, cosplay events, and fan-curated inventory.',
  universesMetaDescription:
    'Explore every universe at House of Spells — Marvel, Star Wars, DC, Middle Earth, Wizarding World, Naruto, and more. Kuala Lumpur, Malaysia.',
  comingSoonFeature: {
    title: 'Kuala Lumpur, Malaysia',
    text: 'A planet-scale fandom destination — online and in the heart of Kuala Lumpur.',
  },
  fandomWorldHeading: 'Fandom World',
  fandomWorldSubtitle: 'Every Universe. Every Story.',
  fandomWorldDescription:
    'The latest from every universe — anime releases, cosplay events in KL, conventions across Asia, and stories from the fandom world.',
};

const CONTENT_MAP: Record<string, MarketContent> = {
  US: US_CONTENT,
  MY: MY_CONTENT,
};

const marketCode = (process.env.NEXT_PUBLIC_MARKET_CODE || 'US').toUpperCase();

export const marketContent: MarketContent =
  CONTENT_MAP[marketCode] ?? US_CONTENT;
