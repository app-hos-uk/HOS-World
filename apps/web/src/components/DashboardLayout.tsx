'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import type { SellerMenuItem } from '@/lib/sellerMenu';


type MenuItem = SellerMenuItem & { badge?: number };

function pathnameMatchesAny(pathname: string | null, paths: string[]): boolean {
  return paths.some((p) => pathname === p || pathname?.startsWith(p + '/') === true);
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  role: string;
  menuItems: MenuItem[];
  title: string;
  /** Link for "Back to Dashboard" in sidebar footer. Defaults to first menu item href. */
  dashboardHref?: string;
  /** Shown for real ADMIN accounts — navigation back to admin panel. */
  backToHref?: { title: string; href: string };
}

export function DashboardLayout({ children, role, menuItems, title, dashboardHref, backToHref }: DashboardLayoutProps) {
  const dashboardLink = dashboardHref ?? menuItems[0]?.href;
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const pathname = usePathname();
  const { logout, user, impersonatedRole } = useAuth();

  /** Show "Back to Admin" for actual ADMIN users (not impersonating a team role). */
  const accountRole = String(user?.role ?? '').toUpperCase();
  const adminBackHref =
    backToHref && accountRole === 'ADMIN' && !impersonatedRole
      ? backToHref
      : undefined;

  const isMenuActive = (item: MenuItem) =>
    pathnameMatchesAny(pathname, [item.href, ...(item.activePathnames ?? [])]);

  const handleLogout = async () => {
    await logout();
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
            <h2 className="text-xl font-bold text-hos-gold">{title}</h2>
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
              {menuItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center justify-between gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      isMenuActive(item)
                        ? 'bg-hos-gold/20 text-hos-gold-hover'
                        : 'text-hos-text-secondary hover:bg-hos-bg-tertiary'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span>{item.icon}</span>
                      <span>{item.title}</span>
                    </span>
                    {item.badge && item.badge > 0 && (
                      <span className="bg-red-500/10 text-white text-xs px-2 py-0.5 rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Footer */}
          <div className="border-t border-hos-border p-4 space-y-1">
            {adminBackHref && (
              <Link
                href={adminBackHref.href}
                className="flex items-center gap-2 px-3 py-2 text-sm text-hos-text-secondary hover:bg-hos-bg-tertiary rounded-lg transition-colors font-medium"
              >
                <span>←</span>
                <span>{adminBackHref.title}</span>
              </Link>
            )}
            {dashboardLink && dashboardLink !== menuItems[0]?.href && (
              <Link
                href={dashboardLink}
                className="flex items-center gap-2 px-3 py-2 text-sm text-hos-gold hover:bg-hos-gold/10 rounded-lg transition-colors font-medium"
              >
                <span>📊</span>
                <span>Dashboard</span>
              </Link>
            )}
            <Link
              href="/"
              className="flex items-center gap-2 px-3 py-2 text-sm text-hos-text-secondary hover:bg-hos-bg-tertiary rounded-lg transition-colors font-medium"
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
        <div className="sticky top-0 z-30 bg-hos-bg-secondary border-b border-hos-border">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden text-hos-text-muted hover:text-hos-text-secondary"
              >
                ☰
              </button>
              {adminBackHref && (
                <Link
                  href={adminBackHref.href}
                  className="text-sm font-medium text-hos-text-secondary hover:text-hos-gold hidden sm:inline"
                >
                  ← {adminBackHref.title}
                </Link>
              )}
              {dashboardLink && dashboardLink !== menuItems[0]?.href && (
                <Link
                  href={dashboardLink}
                  className="text-sm font-medium text-hos-gold hover:text-hos-gold-hover hidden sm:inline"
                >
                  Dashboard
                </Link>
              )}
            </div>
            <div className="flex items-center gap-4">
              {user && (
                <span className="text-sm text-hos-text-secondary hidden sm:inline">
                  {user.firstName} {user.lastName}
                </span>
              )}
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm text-red-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors font-medium"
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* Page Content */}
        <main className="p-4 sm:p-6 lg:p-8 text-hos-text-secondary">{children}</main>
      </div>
    </div>
  );
}

