export interface SellerMenuItem {
  title: string;
  href: string;
  icon: string;
  /** Other pathnames that should highlight this item (e.g. redirect targets). */
  activePathnames?: string[];
}

export function getSellerMenuItems(isWholesaler: boolean): SellerMenuItem[] {
  if (isWholesaler) {
    return [
      { title: 'Dashboard', href: '/wholesaler/dashboard', icon: '📊' },
      {
        title: 'Submit Product',
        href: '/wholesaler/submit-product',
        icon: '➕',
        activePathnames: ['/seller/submit-product'],
      },
      { title: 'My Products', href: '/wholesaler/products', icon: '📦' },
      { title: 'Bulk upload (CSV)', href: '/wholesaler/bulk', icon: '📤' },
      { title: 'Bulk Orders', href: '/wholesaler/orders', icon: '🛒' },
      { title: 'Returns', href: '/seller/returns', icon: '↩️' },
      { title: 'Earnings', href: '/seller/earnings', icon: '💰' },
      { title: 'Submissions', href: '/wholesaler/submissions', icon: '📝' },
      { title: 'Profile', href: '/wholesaler/profile', icon: '👤' },
      { title: 'Themes', href: '/wholesaler/themes', icon: '🎨' },
    ];
  }

  return [
    { title: 'Dashboard', href: '/seller/dashboard', icon: '📊' },
    { title: 'Submit Product', href: '/seller/submit-product', icon: '➕' },
    { title: 'My Products', href: '/seller/products', icon: '📦' },
    { title: 'Orders', href: '/seller/orders', icon: '🛒' },
    { title: 'Returns', href: '/seller/returns', icon: '↩️' },
    { title: 'Earnings', href: '/seller/earnings', icon: '💰' },
    { title: 'Submissions', href: '/seller/submissions', icon: '📝' },
    { title: 'Profile', href: '/seller/profile', icon: '👤' },
    { title: 'Themes', href: '/seller/themes', icon: '🎨' },
    { title: 'Bulk Import', href: '/seller/products/bulk', icon: '📤' },
  ];
}
