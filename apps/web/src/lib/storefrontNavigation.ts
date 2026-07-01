export type NavLink = {
  label: string;
  href: string;
  external?: boolean;
};

export type FooterNavSection = {
  id: string;
  title: string;
  ariaLabel: string;
  links: NavLink[];
};

/** Maps department URL slugs to product category values in search/index */
export const DEPARTMENT_CATEGORY_ALIASES: Record<string, string[]> = {
  collectibles: ['Collectibles', 'collectibles', 'Collectables', 'Collectables & replicas'],
  apparel: ['Apparel', 'apparel', 'Clothing & Apparel', 'Clothing', 'Robes'],
  'home-gifts': ['Home & Gifts', 'Home & gifts', 'Gifts', 'Home', 'home-gifts', 'Home & Decor'],
};

export function expandDepartmentCategories(slugs: string[]): string[] {
  const expanded = new Set<string>();
  for (const slug of slugs) {
    const key = slug.toLowerCase();
    const aliases = DEPARTMENT_CATEGORY_ALIASES[key];
    if (aliases) {
      aliases.forEach((value) => expanded.add(value));
    } else {
      expanded.add(slug);
    }
  }
  return [...expanded];
}

/** Primary storefront nav — always visible in header */
export const STOREFRONT_NAV_PRIMARY: NavLink[] = [
  { label: 'Deals of the day', href: '/products?sortBy=price_asc' },
  { label: 'Shop by franchise', href: '/fandoms' },
  { label: 'Collectibles', href: '/products?category=collectibles' },
  { label: 'Blog', href: '/blog' },
];

/** Secondary links — shown in "More" dropdown */
export const STOREFRONT_NAV_MORE: NavLink[] = [
  { label: 'Apparel & robes', href: '/products?category=apparel' },
  { label: 'Home & gifts', href: '/products?category=home-gifts' },
  { label: 'Marketplace vendors', href: '/sellers' },
  { label: 'All products', href: '/products' },
  { label: 'Gift cards', href: '/gift-cards' },
];

/** @deprecated Use STOREFRONT_NAV_PRIMARY + STOREFRONT_NAV_MORE */
export const STOREFRONT_NAV_LINKS: NavLink[] = [...STOREFRONT_NAV_PRIMARY, ...STOREFRONT_NAV_MORE.filter(
  (link) => !STOREFRONT_NAV_PRIMARY.some((p) => p.href === link.href),
)];

/** Footer column: main shop / navigation links */
export const FOOTER_SHOP_LINKS: NavLink[] = [
  { label: 'Shop Now', href: '/fandoms' },
  { label: 'Blog', href: '/blog' },
  { label: 'On Sale', href: '/products' },
  { label: 'Gift Cards', href: '/gift-cards' },
  { label: 'My Account', href: '/customer/dashboard' },
  { label: 'Loyalty Program', href: '/loyalty' },
  { label: 'About Us', href: '/the-experience' },
  { label: 'Contact Us', href: '/support/new' },
];

/** Footer column: help & policy links */
export const FOOTER_POLICY_LINKS: NavLink[] = [
  { label: 'Help Center', href: '/help' },
  { label: 'Privacy Policy', href: '/privacy-policy' },
  { label: 'Refund Policy', href: '/refund-policy' },
  { label: 'Shipping Policy', href: '/shipping' },
  { label: 'Terms of Service', href: '/terms' },
  { label: 'FAQs', href: '/help#faqs' },
];

/** @deprecated Contact details come from admin site settings / GET /config/site — see siteSettingsDefaults.ts */
export const FOOTER_CONTACT_EMAIL = 'info@houseofspells.com';

export type SocialPlatform = 'facebook' | 'instagram' | 'x';

export const SOCIAL_LINKS: Array<{
  platform: SocialPlatform;
  label: string;
  ariaLabel: string;
  envKey: string;
  fallbackEnvKey?: string;
  defaultHref: string;
}> = [
  {
    platform: 'facebook',
    label: 'Facebook',
    ariaLabel: 'Facebook',
    envKey: 'NEXT_PUBLIC_SOCIAL_FACEBOOK_URL',
    defaultHref: 'https://www.facebook.com/houseofspellsuk',
  },
  {
    platform: 'x',
    label: 'X (Twitter)',
    ariaLabel: 'X (Twitter)',
    envKey: 'NEXT_PUBLIC_SOCIAL_X_URL',
    fallbackEnvKey: 'NEXT_PUBLIC_SOCIAL_TWITTER_URL',
    defaultHref: 'https://x.com/houseofspells',
  },
  {
    platform: 'instagram',
    label: 'Instagram',
    ariaLabel: 'Instagram',
    envKey: 'NEXT_PUBLIC_SOCIAL_INSTAGRAM_URL',
    defaultHref: 'https://www.instagram.com/houseofspells',
  },
];

export function resolveSocialHref(
  envKey: string,
  fallbackEnvKey?: string,
  defaultHref?: string,
): string {
  const primary = process.env[envKey]?.trim();
  if (primary && /^https?:\/\/.+/i.test(primary)) return primary;
  const fallback = fallbackEnvKey ? process.env[fallbackEnvKey]?.trim() : undefined;
  if (fallback && /^https?:\/\/.+/i.test(fallback)) return fallback;
  return defaultHref || '';
}
