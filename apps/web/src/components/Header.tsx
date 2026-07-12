'use client';

import Link from 'next/link';
import { useState, useEffect, Suspense } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { RoleSwitcher } from '@/components/RoleSwitcher';
import { CurrencySelector } from '@/components/CurrencySelector';
import { NotificationBell } from '@/components/NotificationBell';
import { SearchBar } from '@/components/SearchBar';
import type { UserRole } from '@hos-marketplace/shared-types';
import { BrandLogo } from '@/components/BrandLogo';
import {
  getNavPrimary,
  getNavMore,
  loadNavigationFromApi,
  type NavLink,
} from '@/lib/storefrontNavigation';
import { StorefrontNavMore } from '@/components/storefront/StorefrontNavMore';
import { useLoyaltyEnabled } from '@/hooks/useLoyaltyEnabled';

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
    { title: 'Dashboard', href: '/influencer/dashboard', icon: '📊' },
    { title: 'Profile', href: '/influencer/profile', icon: '👤' },
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
  const pathname = usePathname();
  const { user, isAuthenticated, logout, impersonatedRole, effectiveRole, switchRole } = useAuth();
  const { cartItemCount } = useCart();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [navPrimary, setNavPrimary] = useState<NavLink[]>(getNavPrimary());
  const [navMore, setNavMore] = useState<NavLink[]>(getNavMore());
  const loyaltyEnabled = useLoyaltyEnabled();

  useEffect(() => {
    loadNavigationFromApi().then(() => {
      setNavPrimary(getNavPrimary());
      setNavMore(getNavMore());
    });
  }, []);

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

  const accountHref = isAuthenticated && user ? getDashboardLink() : '/login';
  const accountLabel = isAuthenticated && user ? 'Account' : 'Account';

  return (
    <header className="w-full sticky top-0 z-50">
      {/* ROW 1 — Top utility bar */}
      {showCustomerNav && !isDashboardPage && (
        <div className="hidden lg:block w-full bg-gradient-to-b from-[#121218] to-[#0a0a0d] border-b border-hos-border h-8">
          <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
            <p className="text-hos-gold text-sm truncate">
              Marketplace: Shop multiple vendors · Secure checkout · US shipping
            </p>
            <div className="flex items-center gap-5 shrink-0">
              <Link href="/sellers" className="text-hos-text-muted text-sm hover:text-hos-gold transition-colors duration-200">
                Store locations
              </Link>
              <Link href="/seller/onboarding" className="text-hos-text-muted text-xs hover:text-hos-gold transition-colors duration-200">
                Sell with us
              </Link>
              <Link href="/help" className="text-hos-text-muted text-sm hover:text-hos-gold transition-colors duration-200">
                Help Center
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ROW 2 — Main header */}
      <div className="w-full bg-hos-bg border-b border-hos-border">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          {/* Logo — round emblem + wordmark (horizontal) */}
          <BrandLogo variant="horizontal" linked href="/shop" priority />

          {/* Search (Desktop/Tablet) */}
          {showCustomerNav && (
            <div className="hidden md:block flex-1 max-w-xl lg:max-w-2xl mx-2 lg:mx-4">
              <Suspense fallback={<div className="w-full h-10 bg-hos-bg-secondary border border-hos-border rounded-lg animate-pulse" aria-hidden />}>
                <SearchBar compact />
              </Suspense>
            </div>
          )}

          {/* Customer icon actions (Desktop) */}
          {showCustomerNav && (
            <div className="hidden lg:flex items-center gap-4 xl:gap-6 shrink-0">
              {showAuthCustomerNav && !isDashboardPage && <CurrencySelector />}
              {isAuthenticated && user && <NotificationBell />}
              <Link href={accountHref} className="flex flex-col items-center gap-1 group" aria-label={accountLabel}>
                <svg className="w-5 h-5 text-hos-text-secondary group-hover:text-hos-gold transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="text-hos-text-muted text-[11px] group-hover:text-hos-gold transition-colors duration-200">{accountLabel}</span>
              </Link>
              {showAuthCustomerNav && (
                <Link href="/profile" className="flex flex-col items-center gap-1 group">
                  <svg className="w-5 h-5 text-hos-text-secondary group-hover:text-hos-gold transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-hos-text-muted text-[11px] group-hover:text-hos-gold transition-colors duration-200">Profile</span>
                </Link>
              )}
              <Link href="/wishlist" className="flex flex-col items-center gap-1 group" aria-label="Wishlist">
                <svg className="w-5 h-5 text-hos-text-secondary group-hover:text-hos-gold transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                <span className="text-hos-text-muted text-[11px] group-hover:text-hos-gold transition-colors duration-200">Wishlist</span>
              </Link>
              <Link href="/cart" className="relative flex flex-col items-center gap-1 group" aria-label={`Basket${cartItemCount > 0 ? `, ${cartItemCount} items` : ''}`}>
                <svg className="w-5 h-5 text-hos-text-secondary group-hover:text-hos-gold transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                {cartItemCount > 0 && (
                  <span className="absolute -top-1.5 right-0 min-w-[16px] h-4 flex items-center justify-center text-[10px] font-bold bg-hos-gold text-[#1a1406] rounded-full px-1 leading-none">
                    {cartItemCount > 99 ? '99+' : cartItemCount}
                  </span>
                )}
                <span className="text-hos-text-muted text-[11px] group-hover:text-hos-gold transition-colors duration-200">Basket</span>
              </Link>
              {showAuthCustomerNav && (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex flex-col items-center gap-1 group"
                  aria-label="Sign out"
                >
                  <svg className="w-5 h-5 text-hos-text-secondary group-hover:text-hos-sale-red transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span className="text-hos-text-muted text-[11px] group-hover:text-hos-sale-red transition-colors duration-200">Sign out</span>
                </button>
              )}
            </div>
          )}

          {/* Tablet icon actions (md to lg) - simplified for tablets */}
          {showCustomerNav && (
            <div className="hidden md:flex lg:hidden items-center gap-3 shrink-0">
              {isAuthenticated && user && <NotificationBell />}
              <Link href={accountHref} className="p-2 rounded-lg text-hos-text-secondary hover:text-hos-gold hover:bg-hos-bg-secondary transition-colors" aria-label={accountLabel}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </Link>
              <Link href="/wishlist" className="p-2 rounded-lg text-hos-text-secondary hover:text-hos-gold hover:bg-hos-bg-secondary transition-colors" aria-label="Wishlist">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </Link>
              <Link href="/cart" className="relative p-2 rounded-lg text-hos-text-secondary hover:text-hos-gold hover:bg-hos-bg-secondary transition-colors" aria-label="Basket">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                {cartItemCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center text-[10px] font-bold bg-hos-gold text-[#1a1406] rounded-full px-1 leading-none">
                    {cartItemCount > 99 ? '99+' : cartItemCount}
                  </span>
                )}
              </Link>
            </div>
          )}

          {/* Staff / admin actions (Desktop) */}
          {!showCustomerNav && (
            <div className="hidden lg:flex items-center gap-2 shrink-0">
              {isAuthenticated && user ? (
                <>
                  <NotificationBell />
                  <Link
                    href={getDashboardLink()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-hos-gold hover:text-hos-gold-hover hover:bg-hos-bg-secondary rounded-lg transition-colors duration-200"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                    Dashboard
                  </Link>
                  <span className="px-2 py-0.5 text-xs font-semibold bg-hos-bg-secondary text-hos-gold border border-hos-border rounded-full">
                    {ROLE_LABELS[currentRole as UserRole] || currentRole}
                  </span>
                  {user.role === 'ADMIN' && isDashboardPage && <RoleSwitcher />}
                  {impersonatedRole && user.role === 'ADMIN' && !isDashboardPage && (
                    <button
                      onClick={handleBackToAdmin}
                      className="px-3 py-1.5 text-sm bg-hos-new-green hover:opacity-90 text-hos-text-secondary font-medium rounded-lg transition-colors inline-flex items-center gap-1.5"
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
                    className="px-3 py-1.5 text-sm bg-hos-sale-red hover:opacity-90 text-hos-text-secondary font-medium rounded-lg transition-colors"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  className="px-4 py-2 text-sm bg-hos-gold hover:bg-hos-gold-hover text-[#1a1406] font-semibold rounded-lg transition-colors duration-200"
                >
                  Login
                </Link>
              )}
            </div>
          )}

          {/* Tablet: staff/admin actions (md to lg) */}
          {!showCustomerNav && (
            <div className="hidden md:flex lg:hidden items-center gap-2 shrink-0">
              {isAuthenticated && user ? (
                <>
                  <NotificationBell />
                  <Link
                    href={getDashboardLink()}
                    className="p-2 rounded-lg text-hos-gold hover:bg-hos-bg-secondary transition-colors"
                    aria-label="Dashboard"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  </Link>
                  <span className="px-2 py-0.5 text-xs font-semibold bg-hos-bg-secondary text-hos-gold border border-hos-border rounded-full">
                    {ROLE_LABELS[currentRole as UserRole] || currentRole}
                  </span>
                </>
              ) : (
                <Link
                  href="/login"
                  className="px-4 py-2 text-sm bg-hos-gold hover:bg-hos-gold-hover text-[#1a1406] font-semibold rounded-lg transition-colors duration-200"
                >
                  Login
                </Link>
              )}
            </div>
          )}

          {/* Mobile: cart + menu (visible below md) */}
          {showCustomerNav && (
            <Link
              href="/cart"
              className="md:hidden relative p-2 rounded-lg text-hos-gold hover:bg-hos-bg-secondary transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hos-gold-ring"
              aria-label={`Basket${cartItemCount > 0 ? `, ${cartItemCount} items` : ''}`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              {cartItemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center text-[10px] font-bold bg-hos-gold text-[#1a1406] rounded-full px-1 leading-none">
                  {cartItemCount > 99 ? '99+' : cartItemCount}
                </span>
              )}
            </Link>
          )}

          {/* Mobile Menu Button (visible below lg for customer, below md for staff) */}
          <button
            onClick={toggleMobileMenu}
            className={`${showCustomerNav ? 'lg:hidden' : 'md:hidden'} p-2 rounded-lg text-hos-gold hover:bg-hos-bg-secondary transition-colors duration-200`}
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

      {/* ROW 3 — Navigation links (Desktop/Tablet) */}
      {(showCustomerNav || (isAuthenticated && !isCustomerRole && !isDashboardPage && quickLinks.length > 0)) && (
        <div className="hidden lg:block border-t border-hos-border bg-hos-bg">
          <div className="max-w-7xl mx-auto px-4">
            <nav className="flex items-center justify-start gap-x-8 xl:gap-x-10 gap-y-2 py-3 overflow-x-auto scrollbar-thin px-1 min-w-0" role="navigation" aria-label="Main navigation">
              {showCustomerNav && (
                <>
                  {navPrimary.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="text-hos-text-secondary text-sm hover:text-hos-gold transition-colors duration-200 whitespace-nowrap shrink-0"
                    >
                      {item.label}
                    </Link>
                  ))}
                  <StorefrontNavMore items={navMore} />
                </>
              )}
              {showAuthCustomerNav && (
                <>
                  <NavDivider />
                  <NavLink href="/profile" icon="⚙️" label="Manage Profile" currentPath={pathname} />
                  <NavLink href="/orders" icon="📦" label="My Orders" currentPath={pathname} />
                  {loyaltyEnabled && (
                    <NavLink href="/loyalty" icon="✨" label="Rewards" currentPath={pathname} />
                  )}
                </>
              )}
              {showGuestNav && loyaltyEnabled && (
                <>
                  <NavDivider />
                  <NavLink href="/loyalty" icon="✨" label="Rewards" currentPath={pathname} />
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

      {/* Mobile Menu (shown below lg for customers, below md for staff) */}
      {isMobileMenuOpen && (
        <nav className={`${showCustomerNav ? 'lg:hidden' : 'md:hidden'} border-t border-hos-border bg-hos-bg`} role="navigation" aria-label="Mobile navigation">
          <div className="max-w-7xl mx-auto px-4 py-3 space-y-1" role="menu">
            {showCustomerNav && (
              <>
                <div className="px-2 py-2">
                  <Suspense fallback={<div className="w-full h-9 bg-hos-bg-secondary border border-hos-border rounded-lg animate-pulse" aria-hidden />}>
                    <SearchBar compact />
                  </Suspense>
                </div>
                {navPrimary.map((item) => (
                  <MobileNavLink key={item.href} href={item.href} icon="·" label={item.label} onClick={() => setIsMobileMenuOpen(false)} />
                ))}
                {navMore.map((item) => (
                  <MobileNavLink key={`more-${item.href}`} href={item.href} icon="·" label={item.label} onClick={() => setIsMobileMenuOpen(false)} />
                ))}
              </>
            )}
            {showAuthCustomerNav && (
              <>
                <div className="border-t border-hos-border my-2" />
                <MobileNavLink href="/profile" icon="⚙️" label="Manage Profile" onClick={() => setIsMobileMenuOpen(false)} />
                <MobileNavLink href="/wishlist" icon="❤️" label="Wishlist" onClick={() => setIsMobileMenuOpen(false)} />
                <MobileNavLink href="/orders" icon="📦" label="My Orders" onClick={() => setIsMobileMenuOpen(false)} />
                {loyaltyEnabled && (
                  <MobileNavLink href="/loyalty" icon="✨" label="Rewards" onClick={() => setIsMobileMenuOpen(false)} />
                )}
                <MobileNavLink href="/cart" icon="🛒" label={`Basket${cartItemCount > 0 ? ` (${cartItemCount})` : ''}`} onClick={() => setIsMobileMenuOpen(false)} />
                {!isDashboardPage && (
                  <div className="px-3 py-2">
                    <CurrencySelector />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }}
                  className="w-full px-3 py-2.5 text-sm text-hos-sale-red hover:bg-hos-bg-secondary rounded-lg transition-colors text-left flex items-center gap-3"
                >
                  <span className="w-6 text-center text-base leading-none shrink-0" aria-hidden>🚪</span>
                  Sign out
                </button>
              </>
            )}
            {showGuestNav && loyaltyEnabled && (
              <>
                <div className="border-t border-hos-border my-2" />
                <MobileNavLink href="/loyalty" icon="✨" label="Rewards" onClick={() => setIsMobileMenuOpen(false)} />
              </>
            )}
            {showGuestNav && (
              <>
                <div className="border-t border-hos-border my-2" />
                <MobileNavLink href="/cart" icon="🛒" label={`Basket${cartItemCount > 0 ? ` (${cartItemCount})` : ''}`} onClick={() => setIsMobileMenuOpen(false)} />
              </>
            )}

            {isAuthenticated && !isCustomerRole && !isDashboardPage && quickLinks.length > 0 && (
              <>
                <div className="border-t border-hos-border my-2" />
                <p className="px-3 py-1 text-xs font-semibold text-hos-text-muted uppercase tracking-wider">Quick Links</p>
                {quickLinks.map((link) => (
                  <MobileNavLink key={link.href} href={link.href} icon={link.icon} label={link.title} onClick={() => setIsMobileMenuOpen(false)} />
                ))}
              </>
            )}

            <div className="border-t border-hos-border my-2" />
            {isAuthenticated && user ? (
              <div className="space-y-1">
                <MobileNavLink href="/notifications" icon="🔔" label="Notifications" onClick={() => setIsMobileMenuOpen(false)} />
                <MobileNavLink href={getDashboardLink()} icon="📊" label="Dashboard" onClick={() => setIsMobileMenuOpen(false)} />
                <div className="px-3 py-2 flex items-center gap-2">
                  <span className="px-2.5 py-0.5 text-xs font-semibold bg-hos-bg-secondary text-hos-gold border border-hos-border rounded-full">
                    {ROLE_LABELS[currentRole as UserRole] || currentRole}
                  </span>
                  <span className="text-sm text-hos-text-muted truncate">{user.email}</span>
                </div>
                {user.role === 'ADMIN' && isDashboardPage && (
                  <div className="px-3 py-1">
                    <RoleSwitcher />
                  </div>
                )}
                {impersonatedRole && user.role === 'ADMIN' && !isDashboardPage && (
                  <button
                    onClick={() => { handleBackToAdmin(); setIsMobileMenuOpen(false); }}
                    className="w-full px-3 py-2 text-sm bg-hos-new-green hover:opacity-90 text-hos-text-secondary font-medium rounded-lg transition-colors text-center flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Back to Admin
                  </button>
                )}
                <button
                  onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }}
                  className="w-full px-3 py-2.5 text-sm bg-hos-sale-red hover:opacity-90 text-hos-text-secondary font-medium rounded-lg transition-colors text-center"
                >
                  Logout
                </button>
              </div>
            ) : (
              showCustomerNav && (
                <Link
                  href="/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block px-4 py-2.5 text-sm bg-hos-gold hover:bg-hos-gold-hover text-[#1a1406] font-semibold rounded-lg transition-colors text-center"
                >
                  Login
                </Link>
              )
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
      className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors duration-200 whitespace-nowrap shrink-0 ${
        isActive
          ? 'text-hos-gold'
          : 'text-hos-text-secondary hover:text-hos-gold'
      }`}
    >
      <span className="text-sm leading-none" aria-hidden>{icon}</span>
      <span>{label}</span>
      {badge && (
        <span className="ml-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold bg-hos-gold text-[#1a1406] rounded-full px-1">
          {badge}
        </span>
      )}
    </Link>
  );
}

function NavDivider() {
  return <div className="w-px h-5 bg-hos-border mx-1 shrink-0" />;
}

function MobileNavLink({ href, icon, label, onClick }: { href: string; icon: string; label: string; onClick: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-hos-text-secondary hover:text-hos-gold hover:bg-hos-bg-secondary rounded-lg transition-colors duration-200"
    >
      <span className="w-6 text-center text-base leading-none shrink-0" aria-hidden>{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
