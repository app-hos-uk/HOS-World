'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import type { SellerMenuItem } from '@/lib/sellerMenu';
import { ConfirmDialog } from '@/components/ConfirmDialog';

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

export function DashboardLayout({
  children,
  role,
  menuItems,
  title,
  dashboardHref,
  backToHref,
}: DashboardLayoutProps) {
  const dashboardLink = dashboardHref ?? menuItems[0]?.href;
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const pathname = usePathname();
  const { logout, user, impersonatedRole } = useAuth();

  /** Show "Back to Admin" for actual ADMIN users (not impersonating a team role). */
  const accountRole = String(user?.role ?? '').toUpperCase();
  const adminBackHref =
    backToHref && accountRole === 'ADMIN' && !impersonatedRole ? backToHref : undefined;

  const isMenuActive = (item: MenuItem) =>
    pathnameMatchesAny(pathname, [item.href, ...(item.activePathnames ?? [])]);

  const breadcrumbs = useMemo(() => {
    const crumbs: { label: string; href?: string }[] = [{ label: title, href: dashboardLink }];
    const active = menuItems.find((item) => isMenuActive(item));
    if (active && active.href !== dashboardLink) {
      crumbs.push({ label: active.title });
    } else if (pathname && dashboardLink && pathname !== dashboardLink) {
      const segment = pathname.split('/').filter(Boolean).pop();
      if (segment) {
        crumbs.push({
          label: segment.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        });
      }
    }
    return crumbs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, title, dashboardLink, menuItems]);

  const confirmLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
      setLogoutOpen(false);
    }
  };

  return (
    <div className="dashboard-theme min-h-screen bg-hos-bg-secondary font-inter">
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-hos-bg-secondary border-r border-hos-border transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between h-16 px-4 border-b border-hos-border">
            <h2 className="text-lg font-semibold text-hos-gold tracking-tight">{title}</h2>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-hos-text-muted hover:text-hos-text-secondary"
              aria-label="Close sidebar"
            >
              ✕
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-2 py-4" aria-label={`${role} navigation`}>
            <ul className="space-y-1">
              {menuItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                      isMenuActive(item)
                        ? 'bg-hos-gold/20 text-hos-gold-hover'
                        : 'text-hos-text-secondary hover:bg-hos-bg-tertiary'
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span aria-hidden="true">{item.icon}</span>
                      <span className="truncate">{item.title}</span>
                    </span>
                    {item.badge && item.badge > 0 ? (
                      <span className="bg-red-500/15 text-red-300 text-xs px-2 py-0.5 rounded-full shrink-0">
                        {item.badge}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="border-t border-hos-border p-4 space-y-1">
            {adminBackHref ? (
              <Link
                href={adminBackHref.href}
                className="flex items-center gap-2 px-3 py-2 text-sm text-hos-text-secondary hover:bg-hos-bg-tertiary rounded-lg transition-colors font-medium"
              >
                <span aria-hidden="true">←</span>
                <span>{adminBackHref.title}</span>
              </Link>
            ) : null}
            <Link
              href="/"
              className="flex items-center gap-2 px-3 py-2 text-sm text-hos-text-secondary hover:bg-hos-bg-tertiary rounded-lg transition-colors font-medium"
            >
              <span aria-hidden="true">🏠</span>
              <span>View Store</span>
            </Link>
          </div>
        </div>
      </div>

      {sidebarOpen ? (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      <div className="lg:pl-64 transition-all duration-300">
        <div className="sticky top-0 z-30 bg-hos-bg-secondary/95 backdrop-blur-sm border-b border-hos-border">
          <div className="flex items-center justify-between h-14 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden text-hos-text-muted hover:text-hos-text-secondary"
                aria-label="Open sidebar"
              >
                ☰
              </button>
              <nav aria-label="Breadcrumb" className="hidden sm:flex items-center gap-1.5 text-sm min-w-0">
                {breadcrumbs.map((crumb, i) => (
                  <span key={`${crumb.label}-${i}`} className="flex items-center gap-1.5 min-w-0">
                    {i > 0 ? <span className="text-hos-text-muted">/</span> : null}
                    {crumb.href && i < breadcrumbs.length - 1 ? (
                      <Link
                        href={crumb.href}
                        className="text-hos-text-muted hover:text-hos-gold truncate"
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className="text-hos-text-secondary font-medium truncate">{crumb.label}</span>
                    )}
                  </span>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              {user ? (
                <span className="text-sm text-hos-text-secondary hidden sm:inline">
                  {user.firstName} {user.lastName}
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => setLogoutOpen(true)}
                className="px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors font-medium"
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        <main className="p-4 sm:p-6 lg:p-8 text-hos-text-secondary">{children}</main>
      </div>

      <ConfirmDialog
        open={logoutOpen}
        title="Log out?"
        description="You will need to sign in again to access this dashboard."
        confirmLabel="Log out"
        tone="danger"
        busy={loggingOut}
        onCancel={() => setLogoutOpen(false)}
        onConfirm={confirmLogout}
      />
    </div>
  );
}
