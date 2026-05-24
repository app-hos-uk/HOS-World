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

/** Primary storefront nav — shared by header and footer */
export const STOREFRONT_NAV_LINKS: NavLink[] = [
  { label: 'Deals of the Day', href: '/products' },
  { label: 'Shop by franchise', href: '/fandoms' },
  { label: 'Collectibles & replicas', href: '/products?category=collectibles' },
  { label: 'Apparel & robes', href: '/products?category=apparel' },
  { label: 'Home & gifts', href: '/products?category=home-gifts' },
  { label: 'Marketplace vendors', href: '/sellers' },
];

export const FOOTER_NAV_SECTIONS: FooterNavSection[] = [
  {
    id: 'shop',
    title: 'Shop',
    ariaLabel: 'Shop',
    links: [
      ...STOREFRONT_NAV_LINKS,
      { label: 'New arrivals', href: '/products?sort=newest' },
      { label: 'On sale', href: '/products?sort=price_asc' },
      { label: 'Top rated', href: '/products?sort=rating' },
      { label: 'Gift cards', href: '/gift-cards' },
      { label: 'Buy a gift card', href: '/gift-cards/purchase' },
    ],
  },
  {
    id: 'account',
    title: 'Your account',
    ariaLabel: 'Your account',
    links: [
      { label: 'Sign in', href: '/login' },
      { label: 'My dashboard', href: '/customer/dashboard' },
      { label: 'My orders', href: '/orders' },
      { label: 'Track order', href: '/track-order' },
      { label: 'Wishlist', href: '/wishlist' },
      { label: 'Shopping cart', href: '/cart' },
      { label: 'Profile & settings', href: '/profile' },
      { label: 'Digital downloads', href: '/downloads' },
    ],
  },
  {
    id: 'community',
    title: 'Community',
    ariaLabel: 'Community',
    links: [
      { label: 'Loyalty program', href: '/loyalty' },
      { label: 'Earn rewards', href: '/loyalty/rewards' },
      { label: 'Ambassador program', href: '/loyalty/ambassador' },
      { label: 'Quests', href: '/quests' },
      { label: 'Leaderboard', href: '/leaderboard' },
      { label: 'Knowledge base', href: '/support/kb' },
    ],
  },
  {
    id: 'support',
    title: 'Help & policies',
    ariaLabel: 'Help and policies',
    links: [
      { label: 'Help Center', href: '/help' },
      { label: 'Contact support', href: '/support/new' },
      { label: 'My support tickets', href: '/support/tickets' },
      { label: 'Shipping & delivery', href: '/shipping' },
      { label: 'Returns & refunds', href: '/returns' },
      { label: 'Privacy policy', href: '/privacy-policy' },
      { label: 'Do not sell my info', href: '/do-not-sell' },
    ],
  },
  {
    id: 'sell',
    title: 'Sell with us',
    ariaLabel: 'Sell with us',
    links: [
      { label: 'Become a vendor', href: '/seller/onboarding' },
      { label: 'Vendor storefronts', href: '/sellers' },
      { label: 'Store locations', href: '/sellers' },
    ],
  },
];

export const FOOTER_STORE_LOCATIONS = [
  {
    city: 'New York',
    detail: '123 Broadway, New York, NY 10007 · Mon–Sun 10:00–20:00',
  },
  {
    city: 'Los Angeles',
    detail: '8500 Melrose Ave, West Hollywood, CA 90069 · Mon–Sun 10:00–19:00',
  },
] as const;

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
    defaultHref: 'https://www.facebook.com/',
  },
  {
    platform: 'x',
    label: 'X (Twitter)',
    ariaLabel: 'X (Twitter)',
    envKey: 'NEXT_PUBLIC_SOCIAL_X_URL',
    fallbackEnvKey: 'NEXT_PUBLIC_SOCIAL_TWITTER_URL',
    defaultHref: 'https://x.com/',
  },
  {
    platform: 'instagram',
    label: 'Instagram',
    ariaLabel: 'Instagram',
    envKey: 'NEXT_PUBLIC_SOCIAL_INSTAGRAM_URL',
    defaultHref: 'https://www.instagram.com/',
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
