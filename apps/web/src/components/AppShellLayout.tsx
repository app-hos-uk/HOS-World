'use client';

import { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { AdminBreadcrumbs } from '@/components/Breadcrumbs';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import type { ShellMenuItem } from '@/lib/adminMenus';
import { navIcon } from '@/lib/navIcons';

export interface AppShellLayoutProps {
  children: React.ReactNode;
  title: string;
  menuItems: ShellMenuItem[];
  role?: string;
  breadcrumbs?: 'admin' | 'inline' | 'none';
  breadcrumbHome?: { label: string; href: string };
  search?: boolean;
  zoneLabels?: Record<string, string>;
  footerLinks?: { title: string; href: string; icon: React.ReactNode }[];
  backToAdmin?: { title: string; href: string };
  errorBoundary?: boolean;
  persistSidebarScroll?: boolean;
  showUserAvatar?: boolean;
  headerLink?: { title: string; href: string };
  logoutDescription?: string;
}

function NavIcon({ icon }: { icon: React.ReactNode }) {
  if (typeof icon === 'string') {
    return <span aria-hidden="true">{icon}</span>;
  }
  return <span className="w-4 h-4 shrink-0" aria-hidden="true">{icon}</span>;
}

function pathnameMatchesAny(pathname: string | null, paths: string[]): boolean {
  return paths.some((p) => pathname === p || pathname?.startsWith(p + '/') === true);
}

const SIDEBAR_SCROLL_KEY = 'app-shell-sidebar-scroll';

// useLayoutEffect warns during SSR; the scroll restore is browser-only anyway.
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function AppShellLayout({
  children,
  title,
  menuItems,
  role,
  breadcrumbs = 'none',
  breadcrumbHome,
  search = false,
  zoneLabels,
  footerLinks,
  backToAdmin,
  errorBoundary = false,
  persistSidebarScroll = false,
  showUserAvatar = false,
  headerLink,
  logoutDescription = 'You will need to sign in again to access this dashboard.',
}: AppShellLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user, impersonatedRole } = useAuth();
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navScrollRef = useRef<HTMLElement | null>(null);
  // Tracks the last position the user scrolled to. The browser clamps scrollTop to 0
  // while the nav re-renders with collapsed submenus, and that clamp fires a scroll
  // event — persisting it would wipe the position we are trying to restore.
  const lastUserScrollTopRef = useRef<number | null>(null);
  const restoringScrollRef = useRef(false);

  const accountRole = String(user?.role ?? '').toUpperCase();
  const adminBackHref =
    backToAdmin && accountRole === 'ADMIN' && !impersonatedRole ? backToAdmin : undefined;

  const isItemActive = useCallback(
    (item: ShellMenuItem) => {
      const paths = [...(item.href ? [item.href] : []), ...(item.activePathnames ?? [])];
      if (paths.length === 0) return false;
      return pathnameMatchesAny(pathname, paths);
    },
    [pathname]
  );

  const isParentActive = useCallback(
    (item: ShellMenuItem) => {
      if (!item.children) return false;
      return item.children.some((child) => isItemActive(child));
    },
    [isItemActive]
  );

  // Cleanup blur timeout on unmount
  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  // Restore sidebar scroll after navigation once menu expand has settled.
  // Runs before paint so the nav never shows at the top and then jumps.
  useIsomorphicLayoutEffect(() => {
    if (!persistSidebarScroll) return;

    let cancelled = false;
    let raf2 = 0;
    let storedTop = 0;
    try {
      storedTop = Number(sessionStorage.getItem(SIDEBAR_SCROLL_KEY)) || 0;
    } catch {
      // ignore storage errors
    }
    const savedTop = lastUserScrollTopRef.current ?? storedTop;
    restoringScrollRef.current = true;

    const restoreScroll = () => {
      if (cancelled) return;
      const nav = navScrollRef.current;
      if (!nav) return;

      // Submenus expand after the route change, so the scroll height grows in steps.
      // Re-applying the saved offset each time keeps it from being clamped to a
      // shorter, not-yet-expanded list.
      if (savedTop > 0 && nav.scrollTop !== savedTop) {
        nav.scrollTop = savedTop;
      }

      const activeLink = nav.querySelector<HTMLElement>('[data-active-nav="true"]');
      if (!activeLink) return;
      const navBox = nav.getBoundingClientRect();
      const linkBox = activeLink.getBoundingClientRect();
      if (linkBox.top < navBox.top || linkBox.bottom > navBox.bottom) {
        activeLink.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    };

    // Keep correcting while the nav is still growing, then stop so the user can scroll freely.
    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(restoreScroll) : null;
    const stopObserving = setTimeout(() => {
      observer?.disconnect();
      restoringScrollRef.current = false;
    }, 600);

    restoreScroll();

    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        restoreScroll();
        const nav = navScrollRef.current;
        if (nav && observer) {
          observer.observe(nav);
          Array.from(nav.children).forEach((child) => observer.observe(child));
        }
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(stopObserving);
      observer?.disconnect();
      // Do NOT clear restoringScrollRef here — the next effect will set it true
      // immediately and clearing it in the gap lets scroll events persist scrollTop=0.
    };
  }, [pathname, persistSidebarScroll]);

  const handleNavScroll = useCallback(() => {
    if (!persistSidebarScroll) return;
    if (restoringScrollRef.current) return;
    const nav = navScrollRef.current;
    if (!nav) return;
    lastUserScrollTopRef.current = nav.scrollTop;
    try {
      sessionStorage.setItem(SIDEBAR_SCROLL_KEY, String(nav.scrollTop));
    } catch {
      // ignore storage errors
    }
  }, [persistSidebarScroll]);

  // Reset search state on navigation
  useEffect(() => {
    setSearchQuery('');
    setShowSearchResults(false);
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
    }
  }, [pathname]);

  const flattenedMenuItems = useMemo(() => {
    const items: { title: string; href: string; icon: React.ReactNode; parent?: string }[] = [];
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
              parent: item.title,
            });
          }
        });
      }
    });
    return items;
  }, [menuItems]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return flattenedMenuItems.filter(
      (item) =>
        item.title.toLowerCase().includes(query) || item.parent?.toLowerCase().includes(query)
    );
  }, [searchQuery, flattenedMenuItems]);

  useEffect(() => {
    if (!search) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('app-shell-sidebar-search');
        searchInput?.focus();
      }
      if (e.key === 'Escape') {
        setShowSearchResults(false);
        setSearchQuery('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [search]);

  const handleSearchSelect = useCallback(
    (href: string) => {
      router.push(href);
      setSearchQuery('');
      setShowSearchResults(false);
    },
    [router]
  );

  // Auto-expand menus when their children are active
  useEffect(() => {
    const activeMenus = new Set<string>();
    menuItems.forEach((item) => {
      if (item.children && isParentActive(item)) {
        activeMenus.add(item.title);
      }
    });
    // Callers often rebuild menuItems inline, so this effect can run on every paint.
    // Only commit when the expansion actually differs, otherwise the new Set identity
    // schedules another render and the sidebar flickers in a loop.
    setExpandedMenus((prev) => {
      if (
        prev.size === activeMenus.size &&
        Array.from(activeMenus).every((title) => prev.has(title))
      ) {
        return prev;
      }
      return activeMenus;
    });
  }, [pathname, menuItems, isParentActive]);

  const toggleMenu = (menuTitle: string) => {
    const next = new Set(expandedMenus);
    if (next.has(menuTitle)) {
      next.delete(menuTitle);
    } else {
      next.add(menuTitle);
    }
    setExpandedMenus(next);
  };

  const inlineBreadcrumbs = useMemo(() => {
    if (breadcrumbs !== 'inline') return [];
    const home = breadcrumbHome ?? {
      label: title,
      href: menuItems.find((item) => item.href)?.href ?? '/',
    };
    const crumbs: { label: string; href?: string }[] = [{ label: home.label, href: home.href }];
    const active = menuItems.find((item) => isItemActive(item));
    if (active && active.href !== home.href) {
      crumbs.push({ label: active.title });
    } else if (pathname && home.href && pathname !== home.href) {
      const segment = pathname.split('/').filter(Boolean).pop();
      if (segment) {
        crumbs.push({
          label: segment.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        });
      }
    }
    return crumbs;
  }, [breadcrumbs, breadcrumbHome, title, menuItems, pathname, isItemActive]);

  const confirmLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
      setLogoutOpen(false);
    }
  };

  const content = errorBoundary ? <ErrorBoundary>{children}</ErrorBoundary> : children;

  return (
    <div className="dashboard-theme min-h-screen bg-hos-bg-secondary font-inter">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-hos-bg-secondary border-r border-hos-border transition-transform duration-300 shadow-sm ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
        aria-label={`${role ?? title} sidebar`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-hos-border">
            <h2 className="text-lg font-semibold text-hos-gold tracking-tight">{title}</h2>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-hos-text-muted hover:text-hos-text-secondary"
              aria-label="Close sidebar"
            >
              {navIcon('close', 'w-5 h-5')}
            </button>
          </div>

          {/* Search */}
          {search ? (
            <div className="px-3 py-3 border-b border-hos-border relative">
              <div className="relative">
                <input
                  id="app-shell-sidebar-search"
                  type="search"
                  placeholder="Search... (⌘K)"
                  value={searchQuery}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSearchQuery(val);
                    if (blurTimeoutRef.current) {
                      clearTimeout(blurTimeoutRef.current);
                    }
                    setShowSearchResults(val.trim().length > 0);
                  }}
                  onFocus={() => setShowSearchResults(true)}
                  onBlur={() => {
                    if (blurTimeoutRef.current) {
                      clearTimeout(blurTimeoutRef.current);
                    }
                    blurTimeoutRef.current = setTimeout(() => setShowSearchResults(false), 200);
                  }}
                  className="w-full px-3 py-2.5 pl-9 text-sm bg-hos-bg-secondary border border-hos-border rounded-lg focus:bg-hos-bg-secondary focus:border-hos-gold focus:ring-2 focus:ring-hos-gold/20 outline-none transition-all"
                  aria-label="Search navigation"
                />
                <svg
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-hos-text-muted"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>

              {showSearchResults && searchResults.length > 0 && (
                <div
                  className="absolute left-3 right-3 top-full mt-1 bg-hos-bg-secondary rounded-lg shadow-lg border border-hos-border z-50 max-h-64 overflow-y-auto"
                  role="listbox"
                  aria-label="Search results"
                >
                  {searchResults.map((item) => (
                    <button
                      key={item.href}
                      type="button"
                      role="option"
                      aria-selected={false}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleSearchSelect(item.href)}
                      className="w-full px-3 py-2 text-left hover:bg-hos-gold/10 flex items-center gap-2 text-sm"
                    >
                      <NavIcon icon={item.icon} />
                      <span className="font-medium">{item.title}</span>
                      {item.parent ? (
                        <span className="text-hos-text-muted text-xs">in {item.parent}</span>
                      ) : null}
                    </button>
                  ))}
                </div>
              )}

              {showSearchResults && searchQuery && searchResults.length === 0 ? (
                <div className="absolute left-3 right-3 top-full mt-1 bg-hos-bg-secondary rounded-lg shadow-lg border border-hos-border z-50 p-3 text-sm text-hos-text-muted text-center">
                  No results found
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Navigation */}
          <nav
            ref={navScrollRef}
            onScroll={persistSidebarScroll ? handleNavScroll : undefined}
            className="flex-1 overflow-y-auto px-2 py-4"
            aria-label={`${role ?? title} navigation`}
          >
            <ul className="space-y-1">
              {menuItems.map((item, index) => {
                const hasChildren = Boolean(item.children && item.children.length > 0);
                const isExpanded = expandedMenus.has(item.title);
                const parentActive = isParentActive(item);
                const prevZone = index > 0 ? menuItems[index - 1].zone : undefined;
                const showZoneDivider =
                  Boolean(zoneLabels && item.zone) && (index === 0 || item.zone !== prevZone);

                return (
                  <li key={item.title}>
                    {showZoneDivider && item.zone ? (
                      <div
                        className={`pb-1.5 px-3 ${
                          index === 0 ? '' : 'pt-3 mt-2 border-t border-hos-border/50'
                        }`}
                      >
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-hos-text-muted">
                          {zoneLabels?.[item.zone] ?? item.zone}
                        </span>
                      </div>
                    ) : null}

                    {hasChildren ? (
                      <>
                        <button
                          type="button"
                          onClick={() => toggleMenu(item.title)}
                          aria-expanded={isExpanded}
                          className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                            parentActive
                              ? 'bg-hos-gold/10 text-hos-gold-hover'
                              : 'text-hos-text-secondary hover:bg-hos-bg-tertiary'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <NavIcon icon={item.icon} />
                            <span>{item.title}</span>
                          </span>
                          <span
                            className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                            aria-hidden="true"
                          >
                            {navIcon('chevronRight', 'w-3.5 h-3.5')}
                          </span>
                        </button>
                        {isExpanded ? (
                          <ul className="ml-4 mt-1 space-y-1">
                            {item.children!.map((child) => {
                              const childActive = isItemActive(child);
                              return (
                                <li key={child.href || child.title}>
                                  {child.href ? (
                                    <Link
                                      href={child.href}
                                      data-active-nav={childActive ? 'true' : undefined}
                                      className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                                        childActive
                                          ? 'bg-hos-gold/20 text-hos-gold-hover font-medium'
                                          : 'text-hos-text-secondary hover:bg-hos-bg-tertiary'
                                      }`}
                                      aria-current={childActive ? 'page' : undefined}
                                    >
                                      <NavIcon icon={child.icon} />
                                      <span>{child.title}</span>
                                      {child.badge ? (
                                        <span className="ml-auto bg-red-500/10 text-white text-xs px-2 py-0.5 rounded-full">
                                          {child.badge}
                                        </span>
                                      ) : null}
                                    </Link>
                                  ) : (
                                    <span className="flex items-center gap-2 px-3 py-2 text-sm text-hos-text-secondary">
                                      <NavIcon icon={child.icon} />
                                      <span>{child.title}</span>
                                    </span>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        ) : null}
                      </>
                    ) : item.href ? (
                      <Link
                        href={item.href}
                        data-active-nav={isItemActive(item) ? 'true' : undefined}
                        className={`flex items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                          isItemActive(item)
                            ? 'bg-hos-gold/20 text-hos-gold-hover'
                            : 'text-hos-text-secondary hover:bg-hos-bg-tertiary'
                        }`}
                        aria-current={isItemActive(item) ? 'page' : undefined}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <NavIcon icon={item.icon} />
                          <span className="truncate">{item.title}</span>
                        </span>
                        {item.badge && item.badge > 0 ? (
                          <span className="bg-red-500/15 text-red-300 text-xs px-2 py-0.5 rounded-full shrink-0">
                            {item.badge}
                          </span>
                        ) : null}
                      </Link>
                    ) : (
                      <span className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-hos-text-secondary">
                        <NavIcon icon={item.icon} />
                        <span>{item.title}</span>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Footer */}
          <div className="border-t border-hos-border p-3 space-y-1">
            {adminBackHref ? (
              <Link
                href={adminBackHref.href}
                className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-hos-text-secondary hover:bg-hos-bg-tertiary rounded-lg transition-colors font-medium"
              >
                {navIcon('arrowLeft')}
                <span>{adminBackHref.title}</span>
              </Link>
            ) : null}
            {footerLinks?.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-hos-text-secondary hover:bg-hos-bg-tertiary rounded-lg transition-colors font-medium"
              >
                <NavIcon icon={link.icon} />
                <span>{link.title}</span>
              </Link>
            ))}
            <Link
              href="/"
              className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-hos-text-secondary hover:bg-hos-bg-tertiary rounded-lg transition-colors font-medium"
            >
              {navIcon('home')}
              <span>View Store</span>
            </Link>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen ? (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      {/* Main Content */}
      <div className="lg:pl-64 transition-all duration-300">
        {/* Top Bar */}
        <div className="sticky top-0 z-30 bg-hos-bg-secondary/95 backdrop-blur-sm border-b border-hos-border">
          <div className="flex items-center justify-between h-14 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 text-hos-text-muted hover:text-hos-text-secondary hover:bg-hos-bg-tertiary rounded-lg transition-colors"
                aria-label="Open sidebar"
              >
                {navIcon('menu', 'w-5 h-5')}
              </button>

              {breadcrumbs === 'inline' ? (
                <nav aria-label="Breadcrumb" className="hidden sm:flex items-center gap-1.5 text-sm min-w-0">
                  {inlineBreadcrumbs.map((crumb, i) => (
                    <span key={`${crumb.label}-${i}`} className="flex items-center gap-1.5 min-w-0">
                      {i > 0 ? <span className="text-hos-text-muted">/</span> : null}
                      {crumb.href && i < inlineBreadcrumbs.length - 1 ? (
                        <Link
                          href={crumb.href}
                          className="text-hos-text-muted hover:text-hos-gold truncate"
                        >
                          {crumb.label}
                        </Link>
                      ) : (
                        <span className="text-hos-text-secondary font-medium truncate">
                          {crumb.label}
                        </span>
                      )}
                    </span>
                  ))}
                </nav>
              ) : null}

              {breadcrumbs === 'none' && headerLink ? (
                <Link
                  href={headerLink.href}
                  className="text-sm font-medium text-hos-gold hover:text-hos-gold-hover hidden sm:inline"
                >
                  {headerLink.title}
                </Link>
              ) : null}
            </div>

            <div className="flex items-center gap-3 ml-auto shrink-0">
              {breadcrumbs === 'admin' && headerLink ? (
                <Link
                  href={headerLink.href}
                  className="hidden md:inline-flex items-center text-sm text-hos-text-muted hover:text-hos-gold transition-colors"
                >
                  {headerLink.title}
                </Link>
              ) : null}

              {user ? (
                showUserAvatar ? (
                  <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-hos-bg-secondary rounded-lg">
                    <div className="w-7 h-7 bg-hos-gold/20 rounded-full flex items-center justify-center">
                      <span className="text-xs font-medium text-hos-gold">
                        {user.firstName?.[0]}
                        {user.lastName?.[0]}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-hos-text-secondary">
                      {user.firstName} {user.lastName}
                    </span>
                  </div>
                ) : (
                  <span className="text-sm text-hos-text-secondary hidden sm:inline">
                    {user.firstName} {user.lastName}
                  </span>
                )
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

        {breadcrumbs === 'admin' ? (
          <div className="px-4 sm:px-6 lg:px-8 py-2.5 bg-hos-bg-secondary/50">
            <AdminBreadcrumbs />
          </div>
        ) : null}

        <main
          className={`p-4 sm:p-6 lg:p-8 text-hos-text-secondary ${
            breadcrumbs === 'admin'
              ? 'bg-hos-bg-secondary/30 min-h-[calc(100vh-7rem)] overflow-x-auto'
              : ''
          }`}
        >
          {content}
        </main>
      </div>

      <ConfirmDialog
        open={logoutOpen}
        title="Log out?"
        description={logoutDescription}
        confirmLabel="Log out"
        tone="danger"
        busy={loggingOut}
        onCancel={() => setLogoutOpen(false)}
        onConfirm={confirmLogout}
      />
    </div>
  );
}
