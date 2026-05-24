'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { AdminBreadcrumbs } from '@/components/Breadcrumbs';
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface AdminLayoutProps {
  children: React.ReactNode;
}

interface MenuItem {
  title: string;
  href?: string;
  icon: string;
  badge?: number;
  children?: MenuItem[];
}

const menuItems: MenuItem[] = [
  {
    title: 'Dashboard',
    href: '/admin/dashboard',
    icon: '📊',
  },
  {
    title: 'User Management',
    href: '/admin/users',
    icon: '👥',
  },
  {
    title: 'Business Operations',
    icon: '🏢',
    children: [
      { title: 'Product Submissions', href: '/admin/submissions', icon: '📦' },
      { title: 'Procurement Dashboard', href: '/procurement/dashboard', icon: '📊' },
      { title: 'Review Submissions', href: '/procurement/submissions', icon: '✅' },
      { title: 'Orders', href: '/admin/orders', icon: '🛒' },
      { title: 'Shipments', href: '/admin/shipments', icon: '🚚' },
      { title: 'Catalog Admin Queue', href: '/admin/catalog', icon: '📚' },
      { title: 'Catalog Dashboard', href: '/catalog/dashboard', icon: '📊' },
      { title: 'Catalog Team Workflow', href: '/catalog/entries', icon: '📝' },
      { title: 'Marketing Materials', href: '/admin/marketing', icon: '📢' },
      { title: 'Newsletter', href: '/admin/newsletter', icon: '📧' },
      { title: 'Admin Pricing Approvals', href: '/admin/pricing', icon: '💰' },
      { title: 'Pricing Review Workflow', href: '/finance/pricing', icon: '💵' },
      { title: 'Publishing', href: '/admin/publishing', icon: '🚀' },
      { title: 'Media Library', href: '/admin/media', icon: '🖼️' },
    ],
  },
  {
    title: 'Sellers & Wholesalers',
    icon: '🏪',
    children: [
      { title: 'All Sellers', href: '/admin/sellers', icon: '👤' },
      { title: 'Seller Applications', href: '/admin/seller-applications', icon: '📝' },
      { title: 'Vendor Products', href: '/admin/vendor-products', icon: '📋' },
      { title: 'Seller Analytics', href: '/admin/seller-analytics', icon: '📈' },
    ],
  },
  {
    title: 'Influencers',
    icon: '⭐',
    children: [
      { title: 'All Influencers', href: '/admin/influencers', icon: '👤' },
      { title: 'Invitations', href: '/admin/influencers/invitations', icon: '✉️' },
      { title: 'Commissions', href: '/admin/influencers/commissions', icon: '💰' },
      { title: 'Payouts', href: '/admin/influencers/payouts', icon: '💸' },
      { title: 'Campaigns', href: '/admin/influencers/campaigns', icon: '📢' },
    ],
  },
  {
    title: 'Finance',
    icon: '💰',
    children: [
      { title: 'Finance Dashboard', href: '/admin/finance', icon: '💳' },
      { title: 'Settlements', href: '/admin/settlements', icon: '💸' },
    ],
  },
  {
    title: 'Promotions',
    icon: '🎁',
    href: '/admin/promotions',
  },
  {
    title: 'Marketing automation',
    icon: '✨',
    children: [
      { title: 'Journeys', href: '/admin/journeys', icon: '🗺️' },
      { title: 'Message logs', href: '/admin/messaging', icon: '📨' },
      { title: 'Messaging stats', href: '/admin/messaging/stats', icon: '📈' },
    ],
  },
  {
    title: 'Events',
    icon: '🎪',
    children: [
      { title: 'All events', href: '/admin/events', icon: '📅' },
      { title: 'Create event', href: '/admin/events/new', icon: '➕' },
    ],
  },
  {
    title: 'Audiences',
    icon: '🎯',
    children: [
      { title: 'Segments', href: '/admin/segments', icon: '👥' },
      { title: 'Create segment', href: '/admin/segments/new', icon: '➕' },
    ],
  },
  {
    title: 'Ambassadors',
    icon: '🌟',
    children: [
      { title: 'All ambassadors', href: '/admin/ambassadors', icon: '👑' },
      { title: 'UGC review', href: '/admin/ambassadors/ugc', icon: '📸' },
      { title: 'Dashboard', href: '/admin/ambassadors/dashboard', icon: '📊' },
    ],
  },
  {
    title: 'Brand Partnerships',
    icon: '🤝',
    children: [
      { title: 'Partners', href: '/admin/brand-partnerships', icon: '🏢' },
      { title: 'Campaigns', href: '/admin/brand-partnerships/campaigns', icon: '📢' },
      { title: 'New partner', href: '/admin/brand-partnerships/new', icon: '➕' },
      { title: 'Dashboard', href: '/admin/brand-partnerships/dashboard', icon: '📊' },
    ],
  },
  {
    title: 'Loyalty Management',
    icon: '💎',
    children: [
      { title: 'Overview', href: '/admin/loyalty', icon: '📊' },
      { title: 'Tiers', href: '/admin/loyalty/tiers', icon: '🏆' },
      { title: 'Earn Rules', href: '/admin/loyalty/earn-rules', icon: '⚡' },
      { title: 'Redemption Options', href: '/admin/loyalty/redemption-options', icon: '🎁' },
      { title: 'Bonus Campaigns', href: '/admin/loyalty/campaigns', icon: '🎯' },
      { title: 'Members', href: '/admin/loyalty/members', icon: '👥' },
      { title: 'Transactions', href: '/admin/loyalty/transactions', icon: '💳' },
    ],
  },
  {
    title: 'Loyalty Analytics',
    icon: '📈',
    children: [
      { title: 'Program health', href: '/admin/loyalty-analytics', icon: '💡' },
      { title: 'CLV report', href: '/admin/loyalty-analytics/clv', icon: '👤' },
      { title: 'Campaign ROI', href: '/admin/loyalty-analytics/attribution', icon: '🎯' },
      { title: 'Fandom trends', href: '/admin/loyalty-analytics/fandom-trends', icon: '⚡' },
      { title: 'Tier analysis', href: '/admin/loyalty-analytics/tiers', icon: '🏆' },
      { title: 'Channels', href: '/admin/loyalty-analytics/channels', icon: '📊' },
    ],
  },
  {
    title: 'Click & Collect',
    icon: '🏪',
    children: [{ title: 'Orders', href: '/admin/click-collect', icon: '📦' }],
  },
  {
    title: 'Product Campaigns',
    icon: '🎪',
    children: [
      { title: 'All campaigns', href: '/admin/product-campaigns', icon: '📋' },
      { title: 'New campaign', href: '/admin/product-campaigns/new', icon: '➕' },
    ],
  },
  {
    title: 'Stores',
    icon: '🏬',
    children: [
      { title: 'All stores', href: '/admin/stores', icon: '📍' },
      { title: 'New store', href: '/admin/stores/new', icon: '➕' },
    ],
  },
  {
    title: 'Support',
    icon: '🎧',
    children: [
      { title: 'Tickets', href: '/admin/support', icon: '🎫' },
    ],
  },
  {
    title: 'Monitoring',
    icon: '📊',
    children: [
      { title: 'Activity Logs', href: '/admin/activity', icon: '📝' },
      { title: 'Discrepancies', href: '/admin/discrepancies', icon: '⚠️' },
      { title: 'POS Integration', href: '/admin/pos', icon: '🏪' },
      { title: 'Fandom Quizzes', href: '/admin/quiz', icon: '🧙' },
      { title: 'Privacy Audit Log', href: '/admin/privacy-audit', icon: '🔒' },
      { title: 'Notification Templates', href: '/admin/templates', icon: '📋' },
      { title: 'WhatsApp', href: '/admin/whatsapp', icon: '💬' },
    ],
  },
  {
    title: 'Products',
    icon: '🛍️',
    children: [
      { title: 'All Products', href: '/admin/products', icon: '📦' },
      { title: 'Create Product', href: '/admin/products/create', icon: '➕' },
      { title: 'Price Management', href: '/admin/products/pricing', icon: '💰' },
      { title: 'Product Reviews', href: '/admin/reviews', icon: '⭐' },
      { title: 'Fandoms', href: '/admin/categories', icon: '📁' },
      { title: 'Attributes', href: '/admin/attributes', icon: '🔧' },
      { title: 'Tags', href: '/admin/tags', icon: '🏷️' },
    ],
  },
  {
    title: 'System',
    icon: '⚙️',
    children: [
      { title: 'Settings', href: '/admin/settings', icon: '🔧' },
      { title: 'Permissions', href: '/admin/permissions', icon: '🔐' },
      { title: 'Themes', href: '/admin/themes', icon: '🎨' },
      { title: 'Webhooks', href: '/admin/webhooks', icon: '🔗' },
      { title: 'Search', href: '/admin/search', icon: '🔍' },
      { title: 'Domain Management', href: '/admin/domains', icon: '🌐' },
      { title: 'Fulfillment Centers', href: '/admin/fulfillment-centers', icon: '🏭' },
      { title: 'Warehouses', href: '/admin/warehouses', icon: '📦' },
      { title: 'Warehouse Transfers', href: '/admin/warehouses/transfers', icon: '🔄' },
      { title: 'Inventory Dashboard', href: '/admin/inventory', icon: '📊' },
      { title: 'Tax Zones', href: '/admin/tax-zones', icon: '💰' },
      { title: 'Logistics Partners', href: '/admin/logistics', icon: '🚛' },
      { title: 'Customer Groups', href: '/admin/customer-groups', icon: '👥' },
      { title: 'Return Policies', href: '/admin/return-policies', icon: '↩️' },
    ],
  },
  {
    title: 'Analytics & Reports',
    icon: '📊',
    children: [
      { title: 'All Reports', href: '/admin/reports', icon: '📋' },
      { title: 'Sales Reports', href: '/admin/reports/sales', icon: '💵' },
      { title: 'User Analytics', href: '/admin/reports/users', icon: '👥' },
      { title: 'Product Analytics', href: '/admin/reports/products', icon: '📦' },
      { title: 'Platform Metrics', href: '/admin/reports/platform', icon: '📈' },
      { title: 'Inventory Reports', href: '/admin/reports/inventory', icon: '📦' },
    ],
  },
];

/**
 * Team roles sometimes use `/admin/*` tooling with AdminLayout. They must not see full admin navigation
 * (e.g. Admin Dashboard); only destinations allowed by RouteGuard elsewhere.
 */
const TEAM_ADMIN_SHELL_MENUS: Record<string, MenuItem[]> = {
  CATALOG: [
    { title: 'Catalog Dashboard', href: '/catalog/dashboard', icon: '📊' },
    { title: 'Catalog workflow', href: '/catalog/entries', icon: '📝' },
    {
      title: 'Cross-seller duplicates',
      href: '/procurement/submissions?view=cross-seller',
      icon: '🔄',
    },
    { title: 'Vendor Products', href: '/admin/vendor-products', icon: '📋' },
    { title: 'Create Product', href: '/admin/products/create', icon: '➕' },
  ],
  PROCUREMENT: [
    { title: 'Procurement Dashboard', href: '/procurement/dashboard', icon: '📊' },
    { title: 'Review Submissions', href: '/procurement/submissions', icon: '✅' },
    { title: 'Admin Submissions', href: '/admin/submissions', icon: '📦' },
    { title: 'Vendor Products', href: '/admin/vendor-products', icon: '📋' },
  ],
  MARKETING: [
    { title: 'Marketing Dashboard', href: '/marketing/dashboard', icon: '📊' },
    { title: 'Materials', href: '/marketing/materials', icon: '📢' },
    { title: 'Campaigns', href: '/marketing/campaigns', icon: '🎯' },
    { title: 'Admin marketing', href: '/admin/marketing', icon: '📣' },
    { title: 'Influencer commissions', href: '/admin/influencers/commissions', icon: '💸' },
    { title: 'Loyalty Campaigns', href: '/admin/loyalty/campaigns', icon: '🎯' },
    { title: 'Loyalty Earn Rules', href: '/admin/loyalty/earn-rules', icon: '⚡' },
    { title: 'Loyalty Analytics', href: '/admin/loyalty-analytics', icon: '📈' },
  ],
  FINANCE: [
    { title: 'Finance Dashboard', href: '/finance/dashboard', icon: '📊' },
    { title: 'Pricing workflow', href: '/finance/pricing', icon: '💵' },
    { title: 'Product pricing', href: '/admin/products/pricing', icon: '💰' },
    { title: 'Loyalty Overview', href: '/admin/loyalty', icon: '💎' },
    { title: 'Redemption Options', href: '/admin/loyalty/redemption-options', icon: '🎁' },
    { title: 'Loyalty Transactions', href: '/admin/loyalty/transactions', icon: '💳' },
  ],
};

export function AdminLayout({ children }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user } = useAuth();
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const visibleMenuItems = useMemo((): MenuItem[] => {
    const role = String(user?.role ?? '').toUpperCase();
    if (role === 'ADMIN') return menuItems;
    const teamNav = TEAM_ADMIN_SHELL_MENUS[role];
    if (teamNav) return teamNav;
    return [{ title: 'Dashboard', href: '/admin/dashboard', icon: '📊' }];
  }, [user?.role]);

  // Cleanup blur timeout on unmount
  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  // Reset search state on navigation
  useEffect(() => {
    setSearchQuery('');
    setShowSearchResults(false);
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
    }
  }, [pathname]);

  // Flatten visible menu items for search (team shells only search their subset)
  const flattenedMenuItems = useMemo(() => {
    const items: { title: string; href: string; icon: string; parent?: string }[] = [];
    visibleMenuItems.forEach((item) => {
      if (item.href) {
        items.push({ title: item.title, href: item.href, icon: item.icon });
      }
      if (item.children) {
        item.children.forEach((child) => {
          if (child.href) {
            items.push({
              title: child.title,
              href: child.href,
              icon: child.icon,
              parent: item.title,
            });
          }
        });
      }
    });
    return items;
  }, [visibleMenuItems]);

  // Filter menu items based on search
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return flattenedMenuItems.filter(
      (item) => 
        item.title.toLowerCase().includes(query) ||
        item.parent?.toLowerCase().includes(query)
    );
  }, [searchQuery, flattenedMenuItems]);

  // Handle keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('admin-sidebar-search');
        searchInput?.focus();
      }
      if (e.key === 'Escape') {
        setShowSearchResults(false);
        setSearchQuery('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearchSelect = useCallback((href: string) => {
    router.push(href);
    setSearchQuery('');
    setShowSearchResults(false);
  }, [router]);

  const handleLogout = async () => {
    await logout();
  };

  const isActive = (href: string) => {
    return pathname === href || pathname?.startsWith(href + '/');
  };

  const isParentActive = (item: MenuItem) => {
    if (item.children) {
      return item.children.some((child) => child.href && isActive(child.href));
    }
    return false;
  };

  // Auto-expand menus when their children are active
  useEffect(() => {
    const activeMenus = new Set<string>();
    visibleMenuItems.forEach((item) => {
      if (item.children && isParentActive(item)) {
        activeMenus.add(item.title);
      }
    });
    setExpandedMenus(activeMenus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, visibleMenuItems]);

  const toggleMenu = (title: string) => {
    const newExpanded = new Set(expandedMenus);
    if (newExpanded.has(title)) {
      newExpanded.delete(title);
    } else {
      newExpanded.add(title);
    }
    setExpandedMenus(newExpanded);
  };

  return (
    <div className="min-h-screen bg-hos-bg-secondary font-inter">
      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-hos-bg-secondary border-r border-hos-border transition-transform duration-300 shadow-sm ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="flex flex-col h-full">
          {/* Logo/Header */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-hos-border bg-hos-bg-secondary border border-hos-border">
            <h2 className="text-xl font-semibold text-white tracking-tight">Admin Panel</h2>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-white/80 hover:text-white"
            >
              ✕
            </button>
          </div>

          {/* Search */}
          <div className="px-3 py-3 border-b border-hos-border relative">
            <div className="relative">
              <input
                id="admin-sidebar-search"
                type="text"
                placeholder="Search... (⌘K)"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearchResults(true);
                }}
                onFocus={() => setShowSearchResults(true)}
                onBlur={() => {
                  if (blurTimeoutRef.current) {
                    clearTimeout(blurTimeoutRef.current);
                  }
                  blurTimeoutRef.current = setTimeout(() => setShowSearchResults(false), 200);
                }}
                className="w-full px-3 py-2.5 pl-9 text-sm bg-hos-bg-secondary border border-hos-border rounded-lg focus:bg-hos-bg-secondary focus:border-hos-gold focus:ring-2 focus:ring-hos-gold/20 outline-none transition-all"
              />
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-hos-text-muted"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            
            {/* Search Results Dropdown */}
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute left-3 right-3 top-full mt-1 bg-hos-bg-secondary rounded-lg shadow-lg border border-hos-border z-50 max-h-64 overflow-y-auto">
                {searchResults.map((item) => (
                  <button
                    key={item.href}
                    onClick={() => handleSearchSelect(item.href)}
                    className="w-full px-3 py-2 text-left hover:bg-hos-gold/10 flex items-center gap-2 text-sm"
                  >
                    <span>{item.icon}</span>
                    <span className="font-medium">{item.title}</span>
                    {item.parent && (
                      <span className="text-hos-text-muted text-xs">in {item.parent}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
            
            {showSearchResults && searchQuery && searchResults.length === 0 && (
              <div className="absolute left-3 right-3 top-full mt-1 bg-hos-bg-secondary rounded-lg shadow-lg border border-hos-border z-50 p-3 text-sm text-hos-text-muted text-center">
                No results found
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-2 py-4">
            <ul className="space-y-1">
              {visibleMenuItems.map((item) => {
                const hasChildren = item.children && item.children.length > 0;
                const isExpanded = expandedMenus.has(item.title);
                const parentActive = isParentActive(item);

                return (
                  <li key={item.title}>
                    {hasChildren ? (
                      <>
                        <button
                          onClick={() => toggleMenu(item.title)}
                          className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                            parentActive
                              ? 'bg-hos-gold/10 text-hos-gold-hover'
                              : 'text-hos-text-secondary hover:bg-hos-bg-tertiary'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span>{item.icon}</span>
                            <span>{item.title}</span>
                          </span>
                          <span className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                            ▶
                          </span>
                        </button>
                        {isExpanded && (
                          <ul className="ml-4 mt-1 space-y-1">
                            {item.children!.map((child) => (
                              <li key={child.href || child.title}>
                                {child.href ? (
                                  <Link
                                    href={child.href}
                                    className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                                      isActive(child.href)
                                        ? 'bg-hos-gold/20 text-hos-gold-hover font-medium'
                                        : 'text-hos-text-secondary hover:bg-hos-bg-tertiary'
                                    }`}
                                  >
                                    <span>{child.icon}</span>
                                    <span>{child.title}</span>
                                    {child.badge && (
                                      <span className="ml-auto bg-red-500/10 text-white text-xs px-2 py-0.5 rounded-full">
                                        {child.badge}
                                      </span>
                                    )}
                                  </Link>
                                ) : (
                                  <span className="flex items-center gap-2 px-3 py-2 text-sm text-hos-text-secondary">
                                    <span>{child.icon}</span>
                                    <span>{child.title}</span>
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    ) : item.href ? (
                      <Link
                        href={item.href}
                        className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                          isActive(item.href)
                            ? 'bg-hos-gold/20 text-hos-gold-hover'
                            : 'text-hos-text-secondary hover:bg-hos-bg-tertiary'
                        }`}
                      >
                        <span>{item.icon}</span>
                        <span>{item.title}</span>
                        {item.badge && (
                          <span className="ml-auto bg-red-500/10 text-white text-xs px-2 py-0.5 rounded-full">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    ) : (
                      <span className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-hos-text-secondary">
                        <span>{item.icon}</span>
                        <span>{item.title}</span>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Footer */}
          <div className="border-t border-hos-border p-3">
            <Link
              href="/"
              className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-hos-text-secondary hover:bg-hos-bg-tertiary rounded-lg transition-colors font-medium"
            >
              <span>🏠</span>
              <span>View Store</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className={`lg:pl-64 transition-all duration-300`}>
        {/* Top Bar */}
        <div className="sticky top-0 z-30 bg-hos-bg-secondary/95 backdrop-blur-sm border-b border-hos-border">
          <div className="flex items-center justify-between h-14 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 text-hos-text-muted hover:text-hos-text-secondary hover:bg-hos-bg-tertiary rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
            <div className="flex items-center gap-3 ml-auto">
              {user && (
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-hos-bg-secondary rounded-lg">
                  <div className="w-7 h-7 bg-hos-gold/20 rounded-full flex items-center justify-center">
                    <span className="text-xs font-medium text-hos-gold">
                      {user.firstName?.[0]}{user.lastName?.[0]}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-hos-text-secondary">
                    {user.firstName} {user.lastName}
                  </span>
                </div>
              )}
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 text-sm text-red-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors font-medium"
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* Breadcrumbs */}
        <div className="px-4 sm:px-6 lg:px-8 py-2.5 bg-hos-bg-secondary/50">
          <AdminBreadcrumbs />
        </div>

        {/* Page Content */}
        <main className="p-4 sm:p-6 lg:p-8 bg-hos-bg-secondary/30 min-h-[calc(100vh-7rem)]">
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

