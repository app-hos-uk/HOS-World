import type React from 'react';
import { navIcon } from '@/lib/navIcons';

export interface SellerMenuItem {
  title: string;
  href: string;
  icon: React.ReactNode;
  /** Other pathnames that should highlight this item (e.g. redirect targets). */
  activePathnames?: string[];
}

export function getSellerMenuItems(isWholesaler: boolean): SellerMenuItem[] {
  if (isWholesaler) {
    return [
      { title: 'Dashboard', href: '/wholesaler/dashboard', icon: navIcon('dashboard') },
      {
        title: 'Submit Product',
        href: '/wholesaler/submit-product',
        icon: navIcon('plus'),
        activePathnames: ['/seller/submit-product'],
      },
      { title: 'My Products', href: '/wholesaler/products', icon: navIcon('package') },
      { title: 'Bulk upload (CSV)', href: '/wholesaler/bulk', icon: navIcon('upload') },
      { title: 'Bulk Orders', href: '/wholesaler/orders', icon: navIcon('cart') },
      { title: 'Product Analytics', href: '/wholesaler/analytics', icon: navIcon('trending'), activePathnames: ['/seller/analytics'] },
      { title: 'Returns', href: '/wholesaler/returns', icon: navIcon('undo'), activePathnames: ['/seller/returns'] },
      { title: 'Earnings', href: '/wholesaler/earnings', icon: navIcon('dollar'), activePathnames: ['/seller/earnings'] },
      { title: 'Submissions', href: '/wholesaler/submissions', icon: navIcon('fileText') },
      { title: 'Profile', href: '/wholesaler/profile', icon: navIcon('user') },
    ];
  }

  return [
    { title: 'Dashboard', href: '/seller/dashboard', icon: navIcon('dashboard') },
    { title: 'Submit Product', href: '/seller/submit-product', icon: navIcon('plus') },
    { title: 'My Products', href: '/seller/products', icon: navIcon('package') },
    { title: 'Orders', href: '/seller/orders', icon: navIcon('cart') },
    { title: 'Product Analytics', href: '/seller/analytics', icon: navIcon('trending') },
    { title: 'Returns', href: '/seller/returns', icon: navIcon('undo') },
    { title: 'Earnings', href: '/seller/earnings', icon: navIcon('dollar') },
    { title: 'Submissions', href: '/seller/submissions', icon: navIcon('fileText') },
    { title: 'Profile', href: '/seller/profile', icon: navIcon('user') },
    { title: 'Bulk Import', href: '/seller/products/bulk', icon: navIcon('upload') },
  ];
}
