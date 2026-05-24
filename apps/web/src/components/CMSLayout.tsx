'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface CMSLayoutProps {
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
    href: '/cms/dashboard',
    icon: '📊',
  },
  {
    title: 'Content Management',
    icon: '📝',
    children: [
      { title: 'Pages', href: '/cms/pages', icon: '📄' },
      { title: 'Banners', href: '/cms/banners', icon: '🖼️' },
      { title: 'Blog Posts', href: '/cms/blog', icon: '✍️' },
    ],
  },
  {
    title: 'Media Library',
    href: '/cms/media',
    icon: '🖼️',
  },
  {
    title: 'Settings',
    href: '/cms/settings',
    icon: '⚙️',
  },
];

export function CMSLayout({ children }: CMSLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());
  const pathname = usePathname();
  const { logout, user } = useAuth();

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
    <div className="min-h-screen bg-hos-bg-secondary">
      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-hos-bg-secondary border-r border-hos-border transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="flex flex-col h-full">
          {/* Logo/Header */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-hos-border">
            <h2 className="text-xl font-bold text-hos-gold">CMS Portal</h2>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-hos-text-muted hover:text-hos-text-secondary"
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
                                      <span className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
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
                          <span className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
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
          <div className="border-t border-hos-border p-4">
            <Link
              href="/cms/dashboard"
              className="flex items-center gap-2 px-3 py-2 text-sm text-hos-gold hover:bg-hos-gold/10 rounded-lg transition-colors font-medium"
            >
              <span>📊</span>
              <span>Dashboard</span>
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
        <div className="sticky top-0 z-30 bg-hos-bg-secondary border-b border-hos-border">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden text-hos-text-muted hover:text-hos-text-secondary"
              >
                ☰
              </button>
              <Link
                href="/cms/dashboard"
                className="text-sm font-medium text-hos-gold hover:text-hos-gold-hover hidden sm:inline"
              >
                Dashboard
              </Link>
            </div>
            <div className="flex items-center gap-4">
              {user && (
                <span className="text-sm text-hos-text-secondary hidden sm:inline">
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

        {/* Page Content */}
        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}


