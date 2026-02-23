'use client';

import Link from 'next/link';
import { useTheme } from '@hos-marketplace/theme-system';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { RoleSwitcher } from '@/components/RoleSwitcher';
import { CurrencySelector } from '@/components/CurrencySelector';
import { NotificationBell } from '@/components/NotificationBell';
import type { UserRole } from '@hos-marketplace/shared-types';

// Role-specific quick links for the header (non-customer roles)
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
    { title: 'Submit Product', href: '/seller/submit-product', icon: '➕' },
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

  // Determine current role (impersonated or actual)
  const currentRole = effectiveRole || user?.role;

  // Check if user is a customer (or not logged in - they can browse as a guest)
  const isCustomerRole = !isAuthenticated || currentRole === 'CUSTOMER';

  // Check if we're on a dashboard page
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

  // Get dashboard link based on effective role
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

  // Get quick links for current role
  const quickLinks = currentRole && ROLE_QUICK_LINKS[currentRole] ? ROLE_QUICK_LINKS[currentRole] : [];

  return (
    <header 
      className="w-full bg-white border-b-2 border-purple-200 shadow-sm sticky top-0 z-50"
      style={{ backgroundColor: theme.colors.background }}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-3 sm:py-4">
          {/* Logo */}
          <Link 
            href="/" 
            className="text-xl sm:text-2xl font-bold font-primary bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-700 bg-clip-text text-transparent hover:from-purple-600 hover:via-indigo-600 transition-all duration-300"
          >
            House of Spells
          </Link>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-4 lg:space-x-6" role="navigation" aria-label="Main navigation">
            {/* Storefront: Products & Fandoms only when not on dashboard */}
            {isCustomerRole && !isDashboardPage && (
              <>
                <Link 
                  href="/products" 
                  className="text-sm lg:text-base text-purple-700 hover:text-amber-600 font-medium font-secondary transition-colors duration-300"
                >
                  Products
                </Link>
                <Link 
                  href="/fandoms" 
                  className="text-sm lg:text-base text-purple-700 hover:text-amber-600 font-medium font-secondary transition-colors duration-300"
                >
                  Fandoms
                </Link>
              </>
            )}
            {/* Wishlist, My Orders, Cart: always visible for CUSTOMER (storefront and dashboard) so nav works */}
            {isCustomerRole && isAuthenticated && currentRole === 'CUSTOMER' && (
              <>
                <Link 
                  href="/wishlist" 
                  className="text-sm lg:text-base text-purple-700 hover:text-amber-600 font-medium font-secondary transition-colors duration-300"
                  title="Wishlist"
                >
                  ❤️ Wishlist
                </Link>
                <Link 
                  href="/orders" 
                  className="text-sm lg:text-base text-purple-700 hover:text-amber-600 font-medium font-secondary transition-colors duration-300"
                >
                  My Orders
                </Link>
                <Link 
                  href="/cart" 
                  className="relative text-sm lg:text-base text-purple-700 hover:text-amber-600 font-medium font-secondary transition-colors duration-300"
                >
                  Cart
                  {cartItemCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {cartItemCount > 99 ? '99+' : cartItemCount}
                    </span>
                  )}
                </Link>
                {!isDashboardPage && <CurrencySelector />}
              </>
            )}
            {/* Cart for guests (when on storefront) */}
            {isCustomerRole && !isAuthenticated && !isDashboardPage && (
              <Link 
                href="/cart" 
                className="relative text-sm lg:text-base text-purple-700 hover:text-amber-600 font-medium font-secondary transition-colors duration-300"
              >
                Cart
                {cartItemCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {cartItemCount > 99 ? '99+' : cartItemCount}
                  </span>
                )}
              </Link>
            )}

            {/* Role-specific quick links for non-customer roles */}
            {isAuthenticated && !isCustomerRole && !isDashboardPage && quickLinks.length > 0 && (
              <>
                {quickLinks.slice(0, 3).map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="text-sm lg:text-base text-purple-700 hover:text-amber-600 font-medium font-secondary transition-colors duration-300 flex items-center gap-1"
                  >
                    <span>{link.icon}</span>
                    <span>{link.title}</span>
                  </Link>
                ))}
              </>
            )}

            {isAuthenticated && user ? (
              <>
                <NotificationBell />
                {/* Dashboard link for authenticated users */}
                <Link
                  href={getDashboardLink()}
                  className="text-sm lg:text-base text-purple-700 hover:text-amber-600 font-medium font-secondary transition-colors duration-300 flex items-center gap-1"
                >
                  <span>📊</span>
                  <span>Dashboard</span>
                </Link>
                {/* Role badge */}
                <span className="px-2 py-1 text-xs font-semibold bg-purple-100 text-purple-700 rounded-full">
                  {ROLE_LABELS[currentRole as UserRole] || currentRole}
                </span>
                {/* Role Switcher - Show on all dashboards when admin is logged in */}
                {user.role === 'ADMIN' && isDashboardPage && (
                  <RoleSwitcher />
                )}
                {/* Back to Admin button when impersonating */}
                {impersonatedRole && user.role === 'ADMIN' && !isDashboardPage && (
                  <button
                    onClick={handleBackToAdmin}
                    className="px-3 lg:px-4 py-1.5 lg:py-2 text-sm lg:text-base bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white font-semibold rounded-lg transition-all duration-300 font-primary flex items-center gap-2"
                    title="Return to Admin Dashboard"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Back to Admin
                  </button>
                )}
                <button
                  onClick={handleLogout}
                  className="px-3 lg:px-4 py-1.5 lg:py-2 text-sm lg:text-base bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold rounded-lg transition-all duration-300 font-primary"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link 
                href="/login" 
                className="px-3 lg:px-4 py-1.5 lg:py-2 text-sm lg:text-base bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white font-semibold rounded-lg transition-all duration-300 font-primary border border-amber-400/30 hover:border-amber-400/50"
              >
                Login
              </Link>
            )}
          </nav>

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

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <nav className="md:hidden pb-4 border-t border-purple-200 mt-2 pt-4" role="navigation" aria-label="Mobile navigation">
            <div className="flex flex-col space-y-3" role="menu">
              {/* Products & Fandoms only when not on dashboard */}
              {isCustomerRole && !isDashboardPage && (
                <>
                  <Link 
                    href="/products" 
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-base text-purple-700 hover:text-amber-600 font-medium font-secondary transition-colors duration-300 py-2 px-2 rounded-lg hover:bg-purple-50"
                  >
                    Products
                  </Link>
                  <Link 
                    href="/fandoms" 
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-base text-purple-700 hover:text-amber-600 font-medium font-secondary transition-colors duration-300 py-2 px-2 rounded-lg hover:bg-purple-50"
                  >
                    Fandoms
                  </Link>
                </>
              )}
              {/* Wishlist, My Orders, Cart: always for CUSTOMER so nav works from dashboard too */}
              {isCustomerRole && isAuthenticated && currentRole === 'CUSTOMER' && (
                <>
                  <Link 
                    href="/wishlist" 
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-base text-purple-700 hover:text-amber-600 font-medium font-secondary transition-colors duration-300 py-2 px-2 rounded-lg hover:bg-purple-50"
                  >
                    ❤️ Wishlist
                  </Link>
                  <Link 
                    href="/orders" 
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-base text-purple-700 hover:text-amber-600 font-medium font-secondary transition-colors duration-300 py-2 px-2 rounded-lg hover:bg-purple-50"
                  >
                    My Orders
                  </Link>
                  <Link 
                    href="/cart" 
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="relative text-base text-purple-700 hover:text-amber-600 font-medium font-secondary transition-colors duration-300 py-2 px-2 rounded-lg hover:bg-purple-50"
                  >
                    Cart
                    {cartItemCount > 0 && (
                      <span className="ml-2 bg-red-600 text-white text-xs font-bold rounded-full px-2 py-0.5">
                        {cartItemCount > 99 ? '99+' : cartItemCount}
                      </span>
                    )}
                  </Link>
                  {!isDashboardPage && (
                    <div className="px-2 py-2">
                      <CurrencySelector />
                    </div>
                  )}
                </>
              )}
              {/* Cart for guests on storefront */}
              {isCustomerRole && !isAuthenticated && !isDashboardPage && (
                <Link 
                  href="/cart" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="relative text-base text-purple-700 hover:text-amber-600 font-medium font-secondary transition-colors duration-300 py-2 px-2 rounded-lg hover:bg-purple-50"
                >
                  Cart
                  {cartItemCount > 0 && (
                    <span className="ml-2 bg-red-600 text-white text-xs font-bold rounded-full px-2 py-0.5">
                      {cartItemCount > 99 ? '99+' : cartItemCount}
                    </span>
                  )}
                </Link>
              )}

              {/* Role-specific quick links for non-customer roles */}
              {isAuthenticated && !isCustomerRole && !isDashboardPage && quickLinks.length > 0 && (
                <>
                  <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Quick Links
                  </div>
                  {quickLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="text-base text-purple-700 hover:text-amber-600 font-medium font-secondary transition-colors duration-300 py-2 px-2 rounded-lg hover:bg-purple-50 flex items-center gap-2"
                    >
                      <span>{link.icon}</span>
                      <span>{link.title}</span>
                    </Link>
                  ))}
                </>
              )}

              {isAuthenticated && user ? (
                <>
                  <Link
                    href="/notifications"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-base text-purple-700 hover:text-amber-600 font-medium font-secondary transition-colors duration-300 py-2 px-2 rounded-lg hover:bg-purple-50 flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    <span>Notifications</span>
                  </Link>
                  <Link
                    href={getDashboardLink()}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-base text-purple-700 hover:text-amber-600 font-medium font-secondary transition-colors duration-300 py-2 px-2 rounded-lg hover:bg-purple-50 flex items-center gap-2"
                  >
                    <span>📊</span>
                    <span>Dashboard</span>
                  </Link>
                  {/* Role badge */}
                  <div className="px-2 py-2">
                    <span className="px-3 py-1 text-sm font-semibold bg-purple-100 text-purple-700 rounded-full">
                      {ROLE_LABELS[currentRole as UserRole] || currentRole}
                    </span>
                  </div>
                  {/* Role Switcher for mobile */}
                  {user.role === 'ADMIN' && isDashboardPage && (
                    <div className="px-2">
                      <RoleSwitcher />
                    </div>
                  )}
                  {/* Back to Admin button when impersonating */}
                  {impersonatedRole && user.role === 'ADMIN' && !isDashboardPage && (
                    <button
                      onClick={() => {
                        handleBackToAdmin();
                        setIsMobileMenuOpen(false);
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white font-semibold rounded-lg transition-all duration-300 font-primary text-center flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Back to Admin
                    </button>
                  )}
                  <div className="px-4 py-2 text-sm text-gray-600">
                    {user.email}
                  </div>
                  <button
                    onClick={() => {
                      handleLogout();
                      setIsMobileMenuOpen(false);
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold rounded-lg transition-all duration-300 font-primary text-center"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <Link 
                  href="/login" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="px-4 py-2 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white font-semibold rounded-lg transition-all duration-300 font-primary border border-amber-400/30 hover:border-amber-400/50 text-center"
                >
                  Login
                </Link>
              )}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
