'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { AdminBreadcrumbs } from '@/components/Breadcrumbs';

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
      { title: 'Orders', href: '/admin/orders', icon: '🛒' },
      { title: 'Shipments', href: '/admin/shipments', icon: '🚚' },
      { title: 'Catalog Entries', href: '/admin/catalog', icon: '📚' },
      { title: 'Marketing Materials', href: '/admin/marketing', icon: '📢' },
      { title: 'Pricing Approvals', href: '/admin/pricing', icon: '💰' },
    ],
  },
  {
    title: 'Sellers & Wholesalers',
    icon: '🏪',
    children: [
      { title: 'All Sellers', href: '/admin/sellers', icon: '👤' },
      { title: 'Seller Applications', href: '/admin/seller-applications', icon: '📝' },
      { title: 'Seller Analytics', href: '/admin/seller-analytics', icon: '📈' },
    ],
  },
  {
    title: 'Finance',
    icon: '💰',
    children: [
      { title: 'Transactions', href: '/admin/finance', icon: '💳' },
    ],
  },
  {
    title: 'Promotions',
    icon: '🎁',
    href: '/admin/promotions',
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
      { title: 'Categories', href: '/admin/categories', icon: '📁' },
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
      { title: 'Domain Management', href: '/admin/domains', icon: '🌐' },
      { title: 'Fulfillment Centers', href: '/admin/fulfillment-centers', icon: '🏭' },
      { title: 'Warehouses', href: '/admin/warehouses', icon: '📦' },
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
      { title: 'Sales Reports', href: '/admin/reports/sales', icon: '💵' },
      { title: 'User Analytics', href: '/admin/reports/users', icon: '👥' },
      { title: 'Product Analytics', href: '/admin/reports/products', icon: '📦' },
      { title: 'Platform Metrics', href: '/admin/reports/platform', icon: '📈' },
    ],
  },
];

export function AdminLayout({ children }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user } = useAuth();

  // Flatten menu items for search
  const flattenedMenuItems = useMemo(() => {
    const items: { title: string; href: string; icon: string; parent?: string }[] = [];
    menuItems.forEach((item) => {
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
              parent: item.title 
            });
          }
        });
      }
    });
    return items;
  }, []);

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
    menuItems.forEach((item) => {
      if (item.children && isParentActive(item)) {
        activeMenus.add(item.title);
      }
    });
    setExpandedMenus(activeMenus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

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
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="flex flex-col h-full">
          {/* Logo/Header */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-purple-600">Admin Panel</h2>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>

          {/* Search */}
          <div className="px-3 py-3 border-b border-gray-200 relative">
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
                onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
                className="w-full px-3 py-2 pl-9 text-sm bg-gray-100 border border-transparent rounded-lg focus:bg-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-colors"
              />
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
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
              <div className="absolute left-3 right-3 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-64 overflow-y-auto">
                {searchResults.map((item) => (
                  <button
                    key={item.href}
                    onClick={() => handleSearchSelect(item.href)}
                    className="w-full px-3 py-2 text-left hover:bg-purple-50 flex items-center gap-2 text-sm"
                  >
                    <span>{item.icon}</span>
                    <span className="font-medium">{item.title}</span>
                    {item.parent && (
                      <span className="text-gray-400 text-xs">in {item.parent}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
            
            {showSearchResults && searchQuery && searchResults.length === 0 && (
              <div className="absolute left-3 right-3 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 z-50 p-3 text-sm text-gray-500 text-center">
                No results found
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-2 py-4">
            <ul className="space-y-1">
              {menuItems.map((item) => {
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
                              ? 'bg-purple-50 text-purple-700'
                              : 'text-gray-700 hover:bg-gray-100'
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
                                        ? 'bg-purple-100 text-purple-700 font-medium'
                                        : 'text-gray-600 hover:bg-gray-50'
                                    }`}
                                  >
                                    <span>{child.icon}</span>
                                    <span>{child.title}</span>
                                    {child.badge && (
                                      <span className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                                        {child.badge}
                                      </span>
                                    )}
                                  </Link>
                                ) : (
                                  <span className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600">
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
                            ? 'bg-purple-100 text-purple-700'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <span>{item.icon}</span>
                        <span>{item.title}</span>
                        {item.badge && (
                          <span className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    ) : (
                      <span className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700">
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
          <div className="border-t border-gray-200 p-4">
            <Link
              href="/"
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <span>🏠</span>
              <span>Back to Site</span>
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
        <div className="sticky top-0 z-30 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-gray-500 hover:text-gray-700"
            >
              ☰
            </button>
            <div className="flex items-center gap-4">
              {user && (
                <span className="text-sm text-gray-600 hidden sm:inline">
                  {user.firstName} {user.lastName}
                </span>
              )}
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors font-medium"
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* Breadcrumbs */}
        <div className="px-4 sm:px-6 lg:px-8 py-3 bg-gray-50 border-b border-gray-200">
          <AdminBreadcrumbs />
        </div>

        {/* Page Content */}
        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

