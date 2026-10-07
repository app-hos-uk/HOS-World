const marketCode = (process.env.NEXT_PUBLIC_MARKET_CODE || 'US').toUpperCase();

type SiteDefaults = {
  platformName: string;
  platformUrl: string;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  footerAbout: string;
  socialFacebookUrl: string;
  socialInstagramUrl: string;
  socialXUrl: string;
};

const US_DEFAULTS: SiteDefaults = {
  platformName: 'House of Spells Marketplace',
  platformUrl: '',
  contactEmail: 'info@houseofspells.com',
  contactPhone: '+1 (332) 250-4251',
  contactAddress: '234 West 42nd Street, Times Square, New York, NY 10036',
  footerAbout:
    'An immersive fandom experience — franchises, collectibles, and unforgettable finds online and in our stores.',
  socialFacebookUrl: 'https://www.facebook.com/HouseofspellsNYC',
  socialInstagramUrl: 'https://www.instagram.com/houseofspellsnyc',
  socialXUrl: 'https://x.com/houseofspells',
};

const MARKET_SITE_DEFAULTS: Record<string, SiteDefaults> = {
  US: US_DEFAULTS,
  MY: {
    platformName: 'House of Spells Marketplace',
    platformUrl: '',
    contactEmail: 'info@houseofspells.com',
    contactPhone: '+60 3-0000-0000',
    contactAddress: 'Kuala Lumpur, Malaysia',
    footerAbout:
      'An immersive fandom experience — franchises, collectibles, and unforgettable finds online and in our stores.',
    socialFacebookUrl: 'https://www.facebook.com/HouseofspellsMY',
    socialInstagramUrl: 'https://www.instagram.com/houseofspellsmy',
    socialXUrl: 'https://x.com/houseofspells',
  },
};

/** Default storefront branding/contact — overridden by GET /config/site when configured in admin. */
export const DEFAULT_SITE_SETTINGS = MARKET_SITE_DEFAULTS[marketCode] ?? US_DEFAULTS;

export type PublicSiteSettings = {
  platformName: string;
  platformUrl: string;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  footerAbout: string;
  socialFacebookUrl: string;
  socialInstagramUrl: string;
  socialXUrl: string;
};

/** Short brand label for copyright and alt text (strip trailing " Marketplace"). */
export function brandDisplayName(platformName: string): string {
  return platformName.replace(/\s+Marketplace\s*$/i, '').trim() || platformName;
}
