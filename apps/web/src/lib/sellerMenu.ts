export interface SellerMenuItem {
  title: string;
  href: string;
  icon: string;
}

export function getSellerMenuItems(isWholesaler: boolean): SellerMenuItem[] {
  if (isWholesaler) {
    return [
      { title: 'Dashboard', href: '/wholesaler/dashboard', icon: '📊' },
      { title: 'Submit Product', href: '/seller/submit-product', icon: '➕' },
      { title: 'My Products', href: '/wholesaler/products', icon: '📦' },
      { title: 'Bulk Orders', href: '/wholesaler/orders', icon: '🛒' },
      { title: 'Submissions', href: '/wholesaler/submissions', icon: '📝' },
      { title: 'Profile', href: '/wholesaler/profile', icon: '👤' },
      { title: 'Themes', href: '/seller/themes', icon: '🎨' },
    ];
  }

  return [
    { title: 'Dashboard', href: '/seller/dashboard', icon: '📊' },
    { title: 'Submit Product', href: '/seller/submit-product', icon: '➕' },
    { title: 'My Products', href: '/seller/products', icon: '📦' },
    { title: 'Orders', href: '/seller/orders', icon: '🛒' },
    { title: 'Submissions', href: '/seller/submissions', icon: '📝' },
    { title: 'Profile', href: '/seller/profile', icon: '👤' },
    { title: 'Themes', href: '/seller/themes', icon: '🎨' },
    { title: 'Bulk Import', href: '/seller/products/bulk', icon: '📤' },
  ];
}
