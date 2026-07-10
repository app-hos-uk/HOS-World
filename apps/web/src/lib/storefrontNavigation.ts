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

/**
 * Dynamically loaded department display-name map.
 * Populated by `loadDepartmentMappings()` — until then the fallback
 * hardcoded map is used so the very first render still works.
 */
let _departmentDisplayNames: Record<string, string> = {
  collectibles: 'Collectibles',
  apparel: 'Apparel',
  'home-gifts': 'Home & Gifts',
};

let _departmentLoaded = false;

/** Fetch departments from the API and populate the display-name map. */
export async function loadDepartmentMappings(): Promise<void> {
  if (_departmentLoaded) return;
  try {
    const res = await fetch('/api/proxy/departments');
    if (!res.ok) return;
    const json = await res.json();
    const departments: { slug: string; name: string }[] = json?.data ?? [];
    if (departments.length) {
      const map: Record<string, string> = {};
      for (const d of departments) map[d.slug] = d.name;
      _departmentDisplayNames = map;
    }
    _departmentLoaded = true;
  } catch {
    /* use fallback */
  }
}

/** Canonical display name for each department slug (dynamic after load). */
export function getDepartmentDisplayNames(): Record<string, string> {
  return _departmentDisplayNames;
}

/**
 * Resolves department slugs to canonical display names for state/UI.
 * Only one canonical name per department appears in filter chips and sidebar.
 */
export function expandDepartmentCategories(slugs: string[]): string[] {
  const result = new Set<string>();
  const names = getDepartmentDisplayNames();
  for (const slug of slugs) {
    const key = slug.toLowerCase();
    const display = names[key];
    result.add(display || slug);
  }
  return [...result];
}

/**
 * Expands department display names to include the slug as a search alias.
 * The backend search resolves these via Meilisearch synonym/fuzzy matching,
 * but including both forms improves hit rates for edge cases.
 */
export function expandCategoriesForSearch(categories: string[]): string[] {
  const names = getDepartmentDisplayNames();
  const slugToName: Record<string, string> = {};
  const nameToSlug: Record<string, string> = {};
  for (const [slug, name] of Object.entries(names)) {
    slugToName[slug.toLowerCase()] = name;
    nameToSlug[name.toLowerCase()] = slug;
  }

  const result = new Set<string>();
  for (const cat of categories) {
    result.add(cat);
    const key = cat.toLowerCase();
    if (slugToName[key]) result.add(slugToName[key]);
    if (nameToSlug[key]) result.add(nameToSlug[key]);
  }
  return [...result];
}

/** Fallback nav arrays used until the API responds. */
const _FALLBACK_PRIMARY: NavLink[] = [
  { label: 'Deals of the day', href: '/products?sortBy=price_asc&deals=true' },
  { label: 'Shop by franchise', href: '/fandoms' },
  { label: 'Collectibles', href: '/products?category=collectibles' },
  { label: 'Blog', href: '/blog' },
];
const _FALLBACK_MORE: NavLink[] = [
  { label: 'Apparel & robes', href: '/products?category=apparel' },
  { label: 'Home & gifts', href: '/products?category=home-gifts' },
  { label: 'Marketplace vendors', href: '/sellers' },
  { label: 'All products', href: '/products' },
  { label: 'Gift cards', href: '/gift-cards' },
];
const _FALLBACK_FOOTER_SHOP: NavLink[] = [
  { label: 'Shop Now', href: '/fandoms' },
  { label: 'Blog', href: '/blog' },
  { label: 'On Sale', href: '/products' },
  { label: 'Gift Cards', href: '/gift-cards' },
  { label: 'My Account', href: '/customer/dashboard' },
  { label: 'Loyalty Program', href: '/loyalty' },
  { label: 'About Us', href: '/the-experience' },
  { label: 'Contact Us', href: '/support/new' },
];
const _FALLBACK_FOOTER_POLICY: NavLink[] = [
  { label: 'Help Center', href: '/help' },
  { label: 'Privacy Policy', href: '/privacy-policy' },
  { label: 'Refund Policy', href: '/refund-policy' },
  { label: 'Shipping Policy', href: '/shipping' },
  { label: 'Terms of Service', href: '/terms' },
  { label: 'FAQs', href: '/help#faqs' },
];

let _navPrimary: NavLink[] = _FALLBACK_PRIMARY;
let _navMore: NavLink[] = _FALLBACK_MORE;
let _footerShop: NavLink[] = _FALLBACK_FOOTER_SHOP;
let _footerPolicy: NavLink[] = _FALLBACK_FOOTER_POLICY;
let _navLoaded = false;

async function fetchGroup(group: string): Promise<NavLink[]> {
  try {
    const res = await fetch(`/api/proxy/navigation?group=${group}`);
    if (!res.ok) return [];
    const json = await res.json();
    const items: { label: string; href: string; external?: boolean }[] = json?.data ?? [];
    return items.map((i) => ({ label: i.label, href: i.href, external: i.external }));
  } catch {
    return [];
  }
}

/** Load all navigation groups from the API (call once on app mount). */
export async function loadNavigationFromApi(): Promise<void> {
  if (_navLoaded) return;
  const [primary, more, shop, policy] = await Promise.all([
    fetchGroup('header_primary'),
    fetchGroup('header_more'),
    fetchGroup('footer_shop'),
    fetchGroup('footer_policy'),
  ]);
  if (primary.length) _navPrimary = primary;
  if (more.length) _navMore = more;
  if (shop.length) _footerShop = shop;
  if (policy.length) _footerPolicy = policy;
  _navLoaded = true;
}

/** Primary storefront nav — always visible in header */
export const STOREFRONT_NAV_PRIMARY: NavLink[] = _FALLBACK_PRIMARY;
export function getNavPrimary(): NavLink[] { return _navPrimary; }

/** Secondary links — shown in "More" dropdown */
export const STOREFRONT_NAV_MORE: NavLink[] = _FALLBACK_MORE;
export function getNavMore(): NavLink[] { return _navMore; }

/** @deprecated Use getNavPrimary() + getNavMore() */
export const STOREFRONT_NAV_LINKS: NavLink[] = [..._FALLBACK_PRIMARY, ..._FALLBACK_MORE.filter(
  (link) => !_FALLBACK_PRIMARY.some((p) => p.href === link.href),
)];

/** Footer column: main shop / navigation links */
export const FOOTER_SHOP_LINKS: NavLink[] = _FALLBACK_FOOTER_SHOP;
export function getFooterShopLinks(): NavLink[] { return _footerShop; }

/** Footer column: help & policy links */
export const FOOTER_POLICY_LINKS: NavLink[] = _FALLBACK_FOOTER_POLICY;
export function getFooterPolicyLinks(): NavLink[] { return _footerPolicy; }

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
