'use client';

import Link from 'next/link';
import { useTheme } from '@hos-marketplace/theme-system';
import { useState, Suspense } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { RoleSwitcher } from '@/components/RoleSwitcher';
import { CurrencySelector } from '@/components/CurrencySelector';
import { NotificationBell } from '@/components/NotificationBell';
import { SearchBar } from '@/components/SearchBar';
import type { UserRole } from '@hos-marketplace/shared-types';

const ROLE_QUICK_LINKS: Record<string, Array<{ title: string; href: string; icon: string }>> = {
  ADMIN: [
    { title: 'Users', href: '/admin/users', icon: '👥' },
    { title: 'Orders', href: '/admin/orders', icon: '📦' },
    { title: 'Products', href: '/admin/products', icon: '🛍️' },
  ],
  SELLER: [
    { title: 'My Products', href: '/seller/products', icon: '📦' },
    { title: 'Orders', href: '/seller/orders', icon: '🛒' },
    { title: 'Submit Product', href: '/seller/submit-product', icon: '➕' },
  ],
  B2C_SELLER: [
    { title: 'My Products', href: '/seller/products', icon: '📦' },
    { title: 'Orders', href: '/seller/orders', icon: '🛒' },
    { title: 'Submit Product', href: '/seller/submit-product', icon: '➕' },
  ],
  WHOLESALER: [
    { title: 'Bulk Products', href: '/wholesaler/products', icon: '📦' },
    { title: 'Bulk Orders', href: '/wholesaler/orders', icon: '🛒' },
    { title: 'Submit Product', href: '/wholesaler/submit-product', icon: '➕' },
  ],
  INFLUENCER: [
    { title: 'Earnings', href: '/influencer/earnings', icon: '💰' },
    { title: 'Product Links', href: '/influencer/product-links', icon: '🔗' },
    { title: 'Storefront', href: '/influencer/storefront', icon: '🛍️' },
  ],
  PROCUREMENT: [
    { title: 'Submissions', href: '/procurement/submissions', icon: '📝' },
  ],
  FULFILLMENT: [
    { title: 'Shipments', href: '/fulfillment/shipments', icon: '🚚' },
  ],
  CATALOG: [
    { title: 'Entries', href: '/catalog/entries', icon: '📚' },
  ],
  MARKETING: [
    { title: 'Materials', href: '/marketing/materials', icon: '📢' },
  ],
  FINANCE: [
    { title: 'Pricing', href: '/finance/pricing', icon: '💰' },
  ],
  CMS_EDITOR: [
    { title: 'Pages', href: '/cms/pages', icon: '📄' },
    { title: 'Blog', href: '/cms/blog', icon: '✍️' },
    { title: 'Banners', href: '/cms/banners', icon: '🖼️' },
  ],
};

export function Header() {
  const theme = useTheme();
  const pathname = usePathname();
  const { user, isAuthenticated, logout, impersonatedRole, effectiveRole, switchRole } = useAuth();
  const { cartItemCount } = useCart();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const currentRole = effectiveRole || user?.role;
  const isCustomerRole = !isAuthenticated || currentRole === 'CUSTOMER';

  const isDashboardPage = pathname?.includes('/dashboard') ||
    (pathname?.startsWith('/admin/') && pathname !== '/admin') ||
    (pathname?.startsWith('/seller/') && pathname !== '/seller') ||
    pathname?.startsWith('/wholesaler/') ||
    pathname?.startsWith('/influencer/') ||
    pathname?.startsWith('/customer/') ||
    pathname?.startsWith('/procurement/') ||
    pathname?.startsWith('/fulfillment/') ||
    pathname?.startsWith('/catalog/') ||
    pathname?.startsWith('/marketing/') ||
    pathname?.startsWith('/finance/') ||
    pathname?.startsWith('/cms/');

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const getDashboardLink = (): string => {
    if (!user) return '/';
    const roleDashboardMap: Record<UserRole, string> = {
      CUSTOMER: '/customer/dashboard',
      WHOLESALER: '/wholesaler/dashboard',
      B2C_SELLER: '/seller/dashboard',
      SELLER: '/seller/dashboard',
      ADMIN: '/admin/dashboard',
      INFLUENCER: '/influencer/dashboard',
      PROCUREMENT: '/procurement/dashboard',
      FULFILLMENT: '/fulfillment/dashboard',
      CATALOG: '/catalog/dashboard',
      MARKETING: '/marketing/dashboard',
      FINANCE: '/finance/dashboard',
      CMS_EDITOR: '/cms/dashboard',
    } as Record<UserRole, string>;
    return roleDashboardMap[currentRole as UserRole] || '/';
  };

  const ROLE_LABELS: Record<UserRole, string> = {
    CUSTOMER: 'Customer',
    WHOLESALER: 'Wholesaler',
    B2C_SELLER: 'B2C Seller',
    SELLER: 'Seller',
    ADMIN: 'Admin',
    INFLUENCER: 'Influencer',
    PROCUREMENT: 'Procurement',
    FULFILLMENT: 'Fulfillment',
    CATALOG: 'Catalog',
    MARKETING: 'Marketing',
    FINANCE: 'Finance',
    CMS_EDITOR: 'CMS Editor',
  } as Record<UserRole, string>;

  const handleLogout = async () => {
    await logout();
  };

  const handleBackToAdmin = () => {
    switchRole(null);
    if (typeof window !== 'undefined') {
      window.location.href = '/admin/dashboard';
    }
  };

  const quickLinks = currentRole && ROLE_QUICK_LINKS[currentRole] ? ROLE_QUICK_LINKS[currentRole] : [];

  const showCustomerNav = isCustomerRole;
  const showAuthCustomerNav = isCustomerRole && isAuthenticated && currentRole === 'CUSTOMER';
  const showGuestNav = isCustomerRole && !isAuthenticated && !isDashboardPage;

  return (
    <header
      className="w-full bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50"
      style={{ backgroundColor: theme.colors.background }}
    >
      {/* Top Row: Logo, Search, Auth/Account */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 py-3">
          {/* Logo */}
          <Link
            href="/"
            className="text-xl sm:text-2xl font-bold font-primary bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-700 bg-clip-text text-transparent hover:from-purple-600 hover:via-indigo-600 transition-all duration-300 shrink-0"
          >
            House of Spells
          </Link>

          {/* Search (Desktop) */}
          {showCustomerNav && (
            <div className="hidden md:block flex-1 max-w-xl mx-4">
              <Suspense fallback={<div className="w-full h-10 bg-gray-50 border border-gray-200 rounded-lg animate-pulse" aria-hidden />}>
                <SearchBar compact />
              </Suspense>
            </div>
          )}

          {/* Right Actions */}
          <div className="hidden md:flex items-center gap-2 shrink-0">
            {showAuthCustomerNav && !isDashboardPage && <CurrencySelector />}
            {isAuthenticated && user ? (
              <>
                <NotificationBell />
                <Link
                  href={getDashboardLink()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-700 hover:bg-purple-50 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                  Dashboard
                </Link>
                <span className="px-2 py-0.5 text-xs font-semibold bg-purple-100 text-purple-700 rounded-full">
                  {ROLE_LABELS[currentRole as UserRole] || currentRole}
                </span>
                {user.role === 'ADMIN' && isDashboardPage && <RoleSwitcher />}
                {impersonatedRole && user.role === 'ADMIN' && !isDashboardPage && (
                  <button
                    onClick={handleBackToAdmin}
                    className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg transition-colors inline-flex items-center gap-1.5"
                    title="Return to Admin Dashboard"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Admin
                  </button>
                )}
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg transition-colors"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="px-4 py-2 text-sm bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white font-semibold rounded-lg transition-all duration-300 border border-amber-400/30"
              >
                Login
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={toggleMobileMenu}
            className="md:hidden p-2 rounded-lg text-purple-700 hover:bg-purple-50 transition-colors"
            aria-label="Toggle menu"
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Bottom Row: Navigation Links (Desktop) */}
      {(showCustomerNav || (isAuthenticated && !isCustomerRole && !isDashboardPage && quickLinks.length > 0)) && (
        <div className="hidden md:block border-t border-gray-100 bg-gradient-to-r from-purple-50/50 to-indigo-50/50">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex items-center gap-1 py-1.5 overflow-x-auto" role="navigation" aria-label="Main navigation">
              {showCustomerNav && (
                <>
                  <NavLink href="/products" icon="🛍️" label="Products" currentPath={pathname} />
                  <NavLink href="/fandoms" icon="⚡" label="Fandoms" currentPath={pathname} />
                </>
              )}
              {showAuthCustomerNav && (
                <>
                  <NavDivider />
                  <NavLink href="/wishlist" icon="❤️" label="Wishlist" currentPath={pathname} />
                  <NavLink href="/orders" icon="📦" label="My Orders" currentPath={pathname} />
                  <NavLink href="/loyalty" icon="✨" label="Rewards" currentPath={pathname} />
                  <NavLink href="/cart" icon="🛒" label="Cart" currentPath={pathname} badge={cartItemCount > 0 ? (cartItemCount > 99 ? '99+' : String(cartItemCount)) : undefined} />
                </>
              )}
              {showGuestNav && (
                <>
                  <NavDivider />
                  <NavLink href="/loyalty" icon="✨" label="Rewards" currentPath={pathname} />
                  <NavLink href="/cart" icon="🛒" label="Cart" currentPath={pathname} badge={cartItemCount > 0 ? (cartItemCount > 99 ? '99+' : String(cartItemCount)) : undefined} />
                </>
              )}
              {isAuthenticated && !isCustomerRole && !isDashboardPage && quickLinks.length > 0 && (
                <>
                  {quickLinks.slice(0, 4).map((link) => (
                    <NavLink key={link.href} href={link.href} icon={link.icon} label={link.title} currentPath={pathname} />
                  ))}
                </>
              )}
            </nav>
          </div>
        </div>
      )}

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <nav className="md:hidden border-t border-gray-200 bg-white" role="navigation" aria-label="Mobile navigation">
          <div className="container mx-auto px-4 py-3 space-y-1" role="menu">
            {showCustomerNav && (
              <>
                <div className="px-2 py-2">
                  <Suspense fallback={<div className="w-full h-9 bg-gray-50 border border-gray-200 rounded-lg animate-pulse" aria-hidden />}>
                    <SearchBar compact />
                  </Suspense>
                </div>
                <MobileNavLink href="/products" icon="🛍️" label="Products" onClick={() => setIsMobileMenuOpen(false)} />
                <MobileNavLink href="/fandoms" icon="⚡" label="Fandoms" onClick={() => setIsMobileMenuOpen(false)} />
              </>
            )}
            {showAuthCustomerNav && (
              <>
                <div className="border-t border-gray-100 my-2" />
                <MobileNavLink href="/wishlist" icon="❤️" label="Wishlist" onClick={() => setIsMobileMenuOpen(false)} />
                <MobileNavLink href="/orders" icon="📦" label="My Orders" onClick={() => setIsMobileMenuOpen(false)} />
                <MobileNavLink href="/loyalty" icon="✨" label="Rewards" onClick={() => setIsMobileMenuOpen(false)} />
                <MobileNavLink href="/cart" icon="🛒" label={`Cart${cartItemCount > 0 ? ` (${cartItemCount})` : ''}`} onClick={() => setIsMobileMenuOpen(false)} />
                {!isDashboardPage && (
                  <div className="px-3 py-2">
                    <CurrencySelector />
                  </div>
                )}
              </>
            )}
            {showGuestNav && (
              <>
                <div className="border-t border-gray-100 my-2" />
                <MobileNavLink href="/loyalty" icon="✨" label="Rewards" onClick={() => setIsMobileMenuOpen(false)} />
                <MobileNavLink href="/cart" icon="🛒" label={`Cart${cartItemCount > 0 ? ` (${cartItemCount})` : ''}`} onClick={() => setIsMobileMenuOpen(false)} />
              </>
            )}

            {isAuthenticated && !isCustomerRole && !isDashboardPage && quickLinks.length > 0 && (
              <>
                <div className="border-t border-gray-100 my-2" />
                <p className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">Quick Links</p>
                {quickLinks.map((link) => (
                  <MobileNavLink key={link.href} href={link.href} icon={link.icon} label={link.title} onClick={() => setIsMobileMenuOpen(false)} />
                ))}
              </>
            )}

            <div className="border-t border-gray-100 my-2" />
            {isAuthenticated && user ? (
              <div className="space-y-1">
                <MobileNavLink href="/notifications" icon="🔔" label="Notifications" onClick={() => setIsMobileMenuOpen(false)} />
                <MobileNavLink href={getDashboardLink()} icon="📊" label="Dashboard" onClick={() => setIsMobileMenuOpen(false)} />
                <div className="px-3 py-2 flex items-center gap-2">
                  <span className="px-2.5 py-0.5 text-xs font-semibold bg-purple-100 text-purple-700 rounded-full">
                    {ROLE_LABELS[currentRole as UserRole] || currentRole}
                  </span>
                  <span className="text-sm text-gray-500 truncate">{user.email}</span>
                </div>
                {user.role === 'ADMIN' && isDashboardPage && (
                  <div className="px-3 py-1">
                    <RoleSwitcher />
                  </div>
                )}
                {impersonatedRole && user.role === 'ADMIN' && !isDashboardPage && (
                  <button
                    onClick={() => { handleBackToAdmin(); setIsMobileMenuOpen(false); }}
                    className="w-full px-3 py-2 text-sm bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg transition-colors text-center flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Back to Admin
                  </button>
                )}
                <button
                  onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }}
                  className="w-full px-3 py-2.5 text-sm bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg transition-colors text-center"
                >
                  Logout
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block px-4 py-2.5 text-sm bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white font-semibold rounded-lg transition-all text-center border border-amber-400/30"
              >
                Login
              </Link>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}

function NavLink({ href, icon, label, currentPath, badge }: { href: string; icon: string; label: string; currentPath: string | null; badge?: string }) {
  const isActive = currentPath === href || (href !== '/' && currentPath?.startsWith(href));
  return (
    <Link
      href={href}
      className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
        isActive
          ? 'bg-purple-100 text-purple-800'
          : 'text-gray-700 hover:bg-purple-50 hover:text-purple-700'
      }`}
    >
      <span className="text-sm leading-none" aria-hidden>{icon}</span>
      <span>{label}</span>
      {badge && (
        <span className="ml-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold bg-red-600 text-white rounded-full px-1">
          {badge}
        </span>
      )}
    </Link>
  );
}

function NavDivider() {
  return <div className="w-px h-5 bg-gray-200 mx-1 shrink-0" />;
}

function MobileNavLink({ href, icon, label, onClick }: { href: string; icon: string; label: string; onClick: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-purple-50 hover:text-purple-700 rounded-lg transition-colors"
    >
      <span className="w-6 text-center text-base leading-none shrink-0" aria-hidden>{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
