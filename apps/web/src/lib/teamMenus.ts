import type { SellerMenuItem } from '@/lib/sellerMenu';

export type TeamMenuItem = SellerMenuItem & { badge?: number };

/** Shared nav configs so team dashboards cannot drift page-to-page. */

export function getProcurementMenu(pendingCount?: number): TeamMenuItem[] {
  return [
    { title: 'Dashboard', href: '/procurement/dashboard', icon: '📊' },
    {
      title: 'Review Submissions',
      href: '/procurement/submissions',
      icon: '📦',
      badge: pendingCount,
    },
  ];
}

export function getFulfillmentMenu(pendingShipments?: number): TeamMenuItem[] {
  return [
    { title: 'Dashboard', href: '/fulfillment/dashboard', icon: '📊' },
    {
      title: 'Manage Shipments',
      href: '/fulfillment/shipments',
      icon: '🚚',
      badge: pendingShipments,
    },
    { title: 'Centers', href: '/fulfillment/centers', icon: '🏭' },
  ];
}

export function getCatalogMenu(pendingCount?: number): TeamMenuItem[] {
  return [
    { title: 'Dashboard', href: '/catalog/dashboard', icon: '📊' },
    {
      title: 'Catalog Entries',
      href: '/catalog/entries',
      icon: '📚',
      badge: pendingCount,
    },
    {
      title: 'Duplicates',
      href: '/catalog/duplicates',
      icon: '🧩',
    },
  ];
}

export function getMarketingMenu(pendingMaterials?: number): TeamMenuItem[] {
  return [
    { title: 'Dashboard', href: '/marketing/dashboard', icon: '📊' },
    {
      title: 'Marketing Materials',
      href: '/marketing/materials',
      icon: '📢',
      badge: pendingMaterials,
    },
    { title: 'Campaigns', href: '/marketing/campaigns', icon: '📣' },
  ];
}

export function getFinanceMenu(pendingApprovals?: number): TeamMenuItem[] {
  return [
    { title: 'Dashboard', href: '/finance/dashboard', icon: '📊' },
    {
      title: 'Pricing Approvals',
      href: '/finance/pricing',
      icon: '💰',
      badge: pendingApprovals,
    },
    { title: 'Payouts', href: '/finance/payouts', icon: '💸' },
    { title: 'Revenue Reports', href: '/finance/reports/revenue', icon: '📊' },
    { title: 'Fee Reports', href: '/finance/reports/fees', icon: '📋' },
  ];
}
