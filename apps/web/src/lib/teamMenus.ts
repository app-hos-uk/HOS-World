import type { SellerMenuItem } from '@/lib/sellerMenu';
import { navIcon } from '@/lib/navIcons';

export type TeamMenuItem = SellerMenuItem & { badge?: number };

/** Shared nav configs so team dashboards cannot drift page-to-page. */

export function getProcurementMenu(pendingCount?: number): TeamMenuItem[] {
  return [
    { title: 'Dashboard', href: '/procurement/dashboard', icon: navIcon('dashboard') },
    {
      title: 'Review Submissions',
      href: '/procurement/submissions',
      icon: navIcon('package'),
      badge: pendingCount,
    },
  ];
}

export function getFulfillmentMenu(pendingShipments?: number): TeamMenuItem[] {
  return [
    { title: 'Dashboard', href: '/fulfillment/dashboard', icon: navIcon('dashboard') },
    {
      title: 'Manage Shipments',
      href: '/fulfillment/shipments',
      icon: navIcon('truck'),
      badge: pendingShipments,
    },
    { title: 'Centers', href: '/fulfillment/centers', icon: navIcon('factory') },
  ];
}

export function getCatalogMenu(pendingCount?: number): TeamMenuItem[] {
  return [
    { title: 'Dashboard', href: '/catalog/dashboard', icon: navIcon('dashboard') },
    {
      title: 'Catalog Entries',
      href: '/catalog/entries',
      icon: navIcon('library'),
      badge: pendingCount,
    },
    {
      title: 'Duplicates',
      href: '/catalog/duplicates',
      icon: navIcon('puzzle'),
    },
  ];
}

export function getMarketingMenu(pendingMaterials?: number): TeamMenuItem[] {
  return [
    { title: 'Dashboard', href: '/marketing/dashboard', icon: navIcon('dashboard') },
    {
      title: 'Marketing Materials',
      href: '/marketing/materials',
      icon: navIcon('megaphone'),
      badge: pendingMaterials,
    },
    { title: 'Campaigns', href: '/marketing/campaigns', icon: navIcon('volume') },
  ];
}

export function getFinanceMenu(pendingApprovals?: number): TeamMenuItem[] {
  return [
    { title: 'Dashboard', href: '/finance/dashboard', icon: navIcon('dashboard') },
    {
      title: 'Pricing Approvals',
      href: '/finance/pricing',
      icon: navIcon('dollar'),
      badge: pendingApprovals,
    },
    { title: 'Payouts', href: '/finance/payouts', icon: navIcon('wallet') },
    { title: 'Revenue Reports', href: '/finance/reports/revenue', icon: navIcon('dashboard') },
    { title: 'Fee Reports', href: '/finance/reports/fees', icon: navIcon('clipboard') },
  ];
}
