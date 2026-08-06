import type React from 'react';
import { navIcon } from '@/lib/navIcons';

export interface ShellMenuItem {
  title: string;
  href?: string;
  icon: React.ReactNode;
  badge?: number;
  activePathnames?: string[];
  children?: ShellMenuItem[];
  zone?: string;
}

export const ZONE_LABELS: Record<string, string> = {
  quickAccess: 'Quick Access',
  commerce: 'Commerce',
  growth: 'Growth',
  operations: 'Operations',
};

export const menuItems: ShellMenuItem[] = [
  // --- Quick Access ---
  {
    title: 'Dashboard',
    href: '/admin/dashboard',
    icon: navIcon('dashboard'),
    zone: 'quickAccess',
  },
  {
    title: 'Users',
    href: '/admin/users',
    icon: navIcon('users'),
    zone: 'quickAccess',
  },
  {
    title: 'Support Tickets',
    href: '/admin/support',
    icon: navIcon('ticket'),
    zone: 'quickAccess',
  },

  // --- Commerce ---
  {
    title: 'Orders & Fulfillment',
    icon: navIcon('cart'),
    zone: 'commerce',
    children: [
      { title: 'All Orders', href: '/admin/orders', icon: navIcon('cart') },
      { title: 'Returns', href: '/admin/returns', icon: navIcon('undo') },
      { title: 'Cancellations', href: '/admin/cancellations', icon: navIcon('xCircle') },
      { title: 'Shipments', href: '/admin/shipments', icon: navIcon('truck') },
      { title: 'Shipping Methods', href: '/admin/shipping', icon: navIcon('package') },
      { title: 'Manual Carriers', href: '/admin/shipping/carriers', icon: navIcon('tag') },
      { title: 'Click & Collect', href: '/admin/click-collect', icon: navIcon('store') },
      { title: 'Fulfillment Centers', href: '/admin/fulfillment-centers', icon: navIcon('factory') },
      { title: 'Warehouses', href: '/admin/warehouses', icon: navIcon('warehouse') },
      { title: 'Inventory Dashboard', href: '/admin/inventory', icon: navIcon('dashboard') },
    ],
  },
  {
    title: 'Products & Catalog',
    icon: navIcon('shoppingBag'),
    zone: 'commerce',
    children: [
      { title: 'All Products', href: '/admin/products', icon: navIcon('package') },
      { title: 'Create Product', href: '/admin/products/create', icon: navIcon('plus') },
      { title: 'Product Submissions', href: '/admin/submissions', icon: navIcon('fileText') },
      { title: 'Price Management', href: '/admin/products/pricing', icon: navIcon('dollar') },
      { title: 'Catalog Queue', href: '/admin/catalog', icon: navIcon('library') },
      { title: 'Publishing', href: '/admin/publishing', icon: navIcon('rocket') },
      { title: 'Product Reviews', href: '/admin/reviews', icon: navIcon('star') },
      { title: 'Departments', href: '/admin/departments', icon: navIcon('warehouse') },
      { title: 'Fandoms', href: '/admin/categories', icon: navIcon('folder') },
      { title: 'Attributes', href: '/admin/attributes', icon: navIcon('wrench') },
      { title: 'Tags', href: '/admin/tags', icon: navIcon('tag') },
      { title: 'Sales Channels', href: '/admin/channels', icon: navIcon('radio') },
      { title: 'Gift Cards', href: '/admin/gift-cards', icon: navIcon('ticket') },
    ],
  },
  {
    title: 'Sellers & Vendors',
    icon: navIcon('store'),
    zone: 'commerce',
    children: [
      { title: 'All Sellers', href: '/admin/sellers', icon: navIcon('user') },
      { title: 'Seller Applications', href: '/admin/seller-applications', icon: navIcon('fileText') },
      { title: 'Verification Queue', href: '/admin/seller-verifications', icon: navIcon('idCard') },
      { title: 'Vendor Products', href: '/admin/vendor-products', icon: navIcon('clipboard') },
      { title: 'Vendor Ledger', href: '/admin/vendor-ledger', icon: navIcon('bookOpen') },
      { title: 'Seller Analytics', href: '/admin/seller-analytics', icon: navIcon('trending') },
    ],
  },

  // --- Growth ---
  {
    title: 'Marketing & Engagement',
    icon: navIcon('sparkles'),
    zone: 'growth',
    children: [
      { title: 'Promotions', href: '/admin/promotions', icon: navIcon('gift') },
      { title: 'Journeys', href: '/admin/journeys', icon: navIcon('map') },
      { title: 'Marketing Materials', href: '/admin/marketing', icon: navIcon('megaphone') },
      { title: 'Newsletter', href: '/admin/newsletter', icon: navIcon('mail') },
      { title: 'Message Logs', href: '/admin/messaging', icon: navIcon('mailOpen') },
      { title: 'Delivery Dashboard', href: '/admin/notifications/delivery', icon: navIcon('radio') },
      { title: 'Segments', href: '/admin/segments', icon: navIcon('target') },
      { title: 'Product Campaigns', href: '/admin/product-campaigns', icon: navIcon('clipboard') },
      { title: 'Events', href: '/admin/events', icon: navIcon('tent') },
    ],
  },
  {
    title: 'Partners & Creators',
    icon: navIcon('handshake'),
    zone: 'growth',
    children: [
      { title: 'All Influencers', href: '/admin/influencers', icon: navIcon('star') },
      { title: 'Influencer Invitations', href: '/admin/influencers/invitations', icon: navIcon('mailPlus') },
      { title: 'Influencer Commissions', href: '/admin/influencers/commissions', icon: navIcon('dollar') },
      { title: 'Influencer Payouts', href: '/admin/influencers/payouts', icon: navIcon('wallet') },
      { title: 'All Ambassadors', href: '/admin/ambassadors', icon: navIcon('crown') },
      { title: 'Ambassador UGC Review', href: '/admin/ambassadors/ugc', icon: navIcon('camera') },
      { title: 'Ambassador Dashboard', href: '/admin/ambassadors/dashboard', icon: navIcon('dashboard') },
      { title: 'Brand Partnerships', href: '/admin/brand-partnerships', icon: navIcon('handshake') },
    ],
  },
  {
    title: 'Loyalty',
    icon: navIcon('gem'),
    zone: 'growth',
    children: [
      { title: 'Overview', href: '/admin/loyalty', icon: navIcon('dashboard') },
      { title: 'Tiers', href: '/admin/loyalty/tiers', icon: navIcon('trophy') },
      { title: 'Earn Rules', href: '/admin/loyalty/earn-rules', icon: navIcon('zap') },
      { title: 'Redemption Options', href: '/admin/loyalty/redemption-options', icon: navIcon('gift') },
      { title: 'Bonus Campaigns', href: '/admin/loyalty/campaigns', icon: navIcon('target') },
      { title: 'Members', href: '/admin/loyalty/members', icon: navIcon('users') },
      { title: 'Founding Members', href: '/admin/founding-members', icon: navIcon('sparkles') },
      { title: 'Transactions', href: '/admin/loyalty/transactions', icon: navIcon('creditCard') },
      { title: 'Program Health', href: '/admin/loyalty-analytics', icon: navIcon('lightbulb') },
      { title: 'CLV Report', href: '/admin/loyalty-analytics/clv', icon: navIcon('user') },
      { title: 'Fandom Trends', href: '/admin/loyalty-analytics/fandom-trends', icon: navIcon('zap') },
    ],
  },

  // --- Operations ---
  {
    title: 'Finance',
    icon: navIcon('dollar'),
    zone: 'operations',
    children: [
      { title: 'Finance Dashboard', href: '/admin/finance', icon: navIcon('creditCard') },
      { title: 'Settlements', href: '/admin/settlements', icon: navIcon('wallet') },
      { title: 'Pricing Approvals', href: '/admin/pricing', icon: navIcon('banknote') },
      { title: 'Reconciliation', href: '/admin/finance/reconciliation', icon: navIcon('refresh') },
      { title: 'Xero Accounting', href: '/admin/finance/accounting', icon: navIcon('bookOpen') },
      { title: 'Three-way Recon', href: '/admin/finance/three-way-recon', icon: navIcon('scale') },
      { title: 'Disputes', href: '/admin/finance/disputes', icon: navIcon('alert') },
      { title: 'Period Close', href: '/admin/finance/periods', icon: navIcon('calendar') },
      { title: 'Aging Analysis', href: '/admin/finance/aging', icon: navIcon('hourglass') },
      { title: 'Revenue Recognition', href: '/admin/finance/revenue', icon: navIcon('trending') },
    ],
  },
  {
    title: 'Content & Storefront',
    icon: navIcon('pencil'),
    zone: 'operations',
    children: [
      { title: 'Navigation', href: '/admin/navigation', icon: navIcon('compass') },
      { title: 'Universes', href: '/admin/universes', icon: navIcon('orbit') },
      { title: 'Testimonials', href: '/admin/testimonials', icon: navIcon('message') },
      { title: 'Gallery', href: '/admin/gallery', icon: navIcon('camera') },
      { title: 'Blog', href: '/cms/blog', icon: navIcon('fileText') },
      { title: 'Stores', href: '/admin/stores', icon: navIcon('warehouse') },
      { title: 'Themes', href: '/admin/themes', icon: navIcon('palette') },
      { title: 'Media Library', href: '/admin/media', icon: navIcon('image') },
      { title: 'Notification Templates', href: '/admin/templates', icon: navIcon('clipboard') },
    ],
  },
  {
    title: 'Analytics & Reports',
    icon: navIcon('trending'),
    zone: 'operations',
    children: [
      { title: 'All Reports', href: '/admin/reports', icon: navIcon('clipboard') },
      { title: 'Sales Reports', href: '/admin/reports/sales', icon: navIcon('banknote') },
      { title: 'User Analytics', href: '/admin/reports/users', icon: navIcon('users') },
      { title: 'Product Analytics', href: '/admin/reports/products', icon: navIcon('package') },
      { title: 'Platform Metrics', href: '/admin/reports/platform', icon: navIcon('trending') },
      { title: 'Inventory Reports', href: '/admin/reports/inventory', icon: navIcon('package') },
    ],
  },
  {
    title: 'Platform Config',
    icon: navIcon('settings'),
    zone: 'operations',
    children: [
      { title: 'Settings', href: '/admin/settings', icon: navIcon('wrench') },
      { title: 'Feature Flags', href: '/admin/feature-flags', icon: navIcon('flag') },
      { title: 'Permissions', href: '/admin/permissions', icon: navIcon('lock') },
      { title: 'Domain Management', href: '/admin/domains', icon: navIcon('globe') },
      { title: 'Tax Zones', href: '/admin/tax-zones', icon: navIcon('dollar') },
      { title: 'Currencies', href: '/admin/currencies', icon: navIcon('currencies') },
      { title: 'Tenants', href: '/admin/tenants', icon: navIcon('building') },
      { title: 'Customer Groups', href: '/admin/customer-groups', icon: navIcon('users') },
      { title: 'Return Policies', href: '/admin/return-policies', icon: navIcon('undo') },
    ],
  },
  {
    title: 'Integrations & Ops',
    icon: navIcon('plug'),
    zone: 'operations',
    children: [
      { title: 'Webhooks', href: '/admin/webhooks', icon: navIcon('link') },
      { title: 'Search', href: '/admin/search', icon: navIcon('search') },
      { title: 'Logistics Partners', href: '/admin/logistics', icon: navIcon('truck') },
      { title: 'Shipping Integrations', href: '/admin/settings/integrations/shipping', icon: navIcon('truck') },
      { title: 'Activity Logs', href: '/admin/activity', icon: navIcon('fileText') },
      { title: 'Discrepancies', href: '/admin/discrepancies', icon: navIcon('alert') },
      { title: 'POS Integration', href: '/admin/pos', icon: navIcon('store') },
      { title: 'POS Sales', href: '/admin/pos/sales', icon: navIcon('receipt') },
      { title: 'Privacy Audit', href: '/admin/privacy-audit', icon: navIcon('shield') },
      { title: 'WhatsApp', href: '/admin/whatsapp', icon: navIcon('message') },
      { title: 'Quiz', href: '/admin/quiz', icon: navIcon('help') },
    ],
  },
];

/**
 * Team roles sometimes use `/admin/*` tooling with AdminLayout. They must not see full admin navigation
 * (e.g. Admin Dashboard); only destinations allowed by RouteGuard elsewhere.
 */
export const TEAM_ADMIN_SHELL_MENUS: Record<string, ShellMenuItem[]> = {
  CATALOG: [
    { title: 'Catalog Dashboard', href: '/catalog/dashboard', icon: navIcon('dashboard'), zone: 'quickAccess' },
    { title: 'Catalog Workflow', href: '/catalog/entries', icon: navIcon('fileText'), zone: 'quickAccess' },
    {
      title: 'Cross-seller Duplicates',
      href: '/catalog/duplicates',
      icon: navIcon('refresh'),
      zone: 'commerce',
    },
    { title: 'Vendor Products', href: '/admin/vendor-products', icon: navIcon('clipboard'), zone: 'commerce' },
    { title: 'Create Product', href: '/admin/products/create', icon: navIcon('plus'), zone: 'commerce' },
    { title: 'Catalog Queue', href: '/admin/catalog', icon: navIcon('library'), zone: 'commerce' },
  ],
  PROCUREMENT: [
    { title: 'Procurement Dashboard', href: '/procurement/dashboard', icon: navIcon('dashboard'), zone: 'quickAccess' },
    { title: 'Review Submissions', href: '/procurement/submissions', icon: navIcon('checkCircle'), zone: 'commerce' },
    { title: 'Product Submissions', href: '/admin/submissions', icon: navIcon('package'), zone: 'commerce' },
    { title: 'Vendor Products', href: '/admin/vendor-products', icon: navIcon('clipboard'), zone: 'commerce' },
  ],
  MARKETING: [
    { title: 'Marketing Dashboard', href: '/marketing/dashboard', icon: navIcon('dashboard'), zone: 'quickAccess' },
    { title: 'Materials', href: '/marketing/materials', icon: navIcon('megaphone'), zone: 'growth' },
    { title: 'Campaigns', href: '/marketing/campaigns', icon: navIcon('target'), zone: 'growth' },
    { title: 'Admin Marketing', href: '/admin/marketing', icon: navIcon('volume'), zone: 'growth' },
    { title: 'Founding Members', href: '/admin/founding-members', icon: navIcon('sparkles'), zone: 'growth' },
    { title: 'Influencer Commissions', href: '/admin/influencers/commissions', icon: navIcon('wallet'), zone: 'growth' },
    { title: 'Loyalty Campaigns', href: '/admin/loyalty/campaigns', icon: navIcon('target'), zone: 'growth' },
    { title: 'Loyalty Earn Rules', href: '/admin/loyalty/earn-rules', icon: navIcon('zap'), zone: 'growth' },
    { title: 'Loyalty Analytics', href: '/admin/loyalty-analytics', icon: navIcon('trending'), zone: 'growth' },
  ],
  FINANCE: [
    { title: 'Finance Dashboard', href: '/finance/dashboard', icon: navIcon('dashboard'), zone: 'quickAccess' },
    {
      title: 'Pricing',
      icon: navIcon('banknote'),
      zone: 'operations',
      children: [
        { title: 'Pricing Workflow', href: '/finance/pricing', icon: navIcon('banknote') },
        { title: 'Product Pricing', href: '/admin/products/pricing', icon: navIcon('dollar') },
        { title: 'Pricing Approvals', href: '/admin/pricing', icon: navIcon('banknote') },
        { title: 'Cancellations', href: '/admin/cancellations', icon: navIcon('xCircle') },
      ],
    },
    {
      title: 'Loyalty Finance',
      icon: navIcon('gem'),
      zone: 'operations',
      children: [
        { title: 'Loyalty Overview', href: '/admin/loyalty', icon: navIcon('gem') },
        { title: 'Redemption Options', href: '/admin/loyalty/redemption-options', icon: navIcon('gift') },
        { title: 'Loyalty Transactions', href: '/admin/loyalty/transactions', icon: navIcon('creditCard') },
      ],
    },
    {
      title: 'Accounting & Close',
      icon: navIcon('bookOpen'),
      zone: 'operations',
      children: [
        { title: 'Reconciliation', href: '/admin/finance/reconciliation', icon: navIcon('refresh') },
        { title: 'Xero Accounting', href: '/admin/finance/accounting', icon: navIcon('bookOpen') },
        { title: 'Three-way Recon', href: '/admin/finance/three-way-recon', icon: navIcon('scale') },
        { title: 'Disputes', href: '/admin/finance/disputes', icon: navIcon('alert') },
        { title: 'Period Close', href: '/admin/finance/periods', icon: navIcon('calendar') },
        { title: 'Aging Analysis', href: '/admin/finance/aging', icon: navIcon('hourglass') },
        { title: 'Revenue Recognition', href: '/admin/finance/revenue', icon: navIcon('trending') },
      ],
    },
  ],
};

/**
 * Full admin nav for ADMIN. When an admin uses role impersonation, show that
 * team's shell menu. Other roles get their team shell (or dashboard only).
 */
export function getAdminMenuItems(userRole: string, effectiveRole: string): ShellMenuItem[] {
  const actualRole = String(userRole ?? '').toUpperCase();
  const role = String(effectiveRole ?? userRole ?? '').toUpperCase();
  if (actualRole === 'ADMIN' && role === 'ADMIN') return menuItems;
  const teamNav = TEAM_ADMIN_SHELL_MENUS[role];
  if (teamNav) return teamNav;
  if (actualRole === 'ADMIN') return menuItems;
  return [{ title: 'Dashboard', href: '/admin/dashboard', icon: navIcon('dashboard') }];
}

export function getCmsMenu(): ShellMenuItem[] {
  return [
    {
      title: 'Dashboard',
      href: '/cms/dashboard',
      icon: navIcon('dashboard'),
    },
    {
      title: 'Content Management',
      icon: navIcon('fileText'),
      children: [
        { title: 'Pages', href: '/cms/pages', icon: navIcon('file') },
        { title: 'Banners', href: '/cms/banners', icon: navIcon('image') },
        { title: 'Blog Posts', href: '/cms/blog', icon: navIcon('penLine') },
        { title: 'Blog Categories', href: '/cms/blog/categories', icon: navIcon('tag') },
      ],
    },
    {
      title: 'Media Library',
      href: '/cms/media',
      icon: navIcon('image'),
    },
    {
      title: 'Settings',
      href: '/cms/settings',
      icon: navIcon('settings'),
    },
  ];
}
