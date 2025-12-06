'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

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
    title: 'Products',
    icon: '🛍️',
    children: [
      { title: 'All Products', href: '/admin/products', icon: '📦' },
      { title: 'Product Reviews', href: '/admin/reviews', icon: '⭐' },
      { title: 'Categories & Tags', href: '/admin/categories', icon: '🏷️' },
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
      { title: 'Logistics Partners', href: '/admin/logistics', icon: '🚛' },
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
  const pathname = usePathname();

  const toggleMenu = (title: string) => {
    const newExpanded = new Set(expandedMenus);
    if (newExpanded.has(title)) {
      newExpanded.delete(title);
    } else {
      newExpanded.add(title);
    }
    setExpandedMenus(newExpanded);
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
              <span className="text-sm text-gray-600">Admin Portal</span>
            </div>
          </div>
        </div>

        {/* Page Content */}
        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

