/** Default storefront branding/contact — overridden by GET /config/site when configured in admin. */
export const DEFAULT_SITE_SETTINGS = {
  platformName: 'House of Spells Marketplace',
  platformUrl: '',
  contactEmail: 'info@houseofspells.com',
  contactPhone: '+1 (212) 555-0199',
  contactAddress: '1564 Broadway, Times Square, New York, NY 10036',
  footerAbout:
    'An immersive fandom experience — franchises, collectibles, and unforgettable finds online and in our stores.',
  socialFacebookUrl: 'https://www.facebook.com/houseofspellsuk',
  socialInstagramUrl: 'https://www.instagram.com/houseofspells',
  socialXUrl: 'https://x.com/houseofspells',
} as const;

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
