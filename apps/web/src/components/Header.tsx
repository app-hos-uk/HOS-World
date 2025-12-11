'use client';

import Link from 'next/link';
import { useTheme } from '@hos-marketplace/theme-system';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { RoleSwitcher } from '@/components/RoleSwitcher';
import { CurrencySelector } from '@/components/CurrencySelector';
import type { UserRole } from '@hos-marketplace/shared-types';

export function Header() {
  const theme = useTheme();
  const pathname = usePathname();
  const { user, isAuthenticated, logout, hasRole, impersonatedRole, effectiveRole, switchRole } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Check if we're on a dashboard page - be more specific to avoid hiding menus on non-dashboard pages
  const isDashboardPage = pathname?.includes('/dashboard') || 
    pathname === '/admin/dashboard' ||
    pathname === '/seller/dashboard' ||
    pathname === '/wholesaler/dashboard' ||
    pathname === '/procurement/dashboard' ||
    pathname === '/fulfillment/dashboard' ||
    pathname === '/catalog/dashboard' ||
    pathname === '/marketing/dashboard' ||
    pathname === '/finance/dashboard' ||
    pathname?.startsWith('/admin/') && pathname !== '/admin' ||
    pathname?.startsWith('/seller/') && pathname !== '/seller' ||
    pathname?.startsWith('/wholesaler/') ||
    pathname?.startsWith('/procurement/') ||
    pathname?.startsWith('/fulfillment/') ||
    pathname?.startsWith('/catalog/') ||
    pathname?.startsWith('/marketing/') ||
    pathname?.startsWith('/finance/');

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  // Get dashboard link based on effective role (impersonated if set)
  const getDashboardLink = (): string => {
    if (!user) return '/';
    
    const currentRole = effectiveRole || user.role;
    
    const roleDashboardMap: Record<UserRole, string> = {
      CUSTOMER: '/',
      WHOLESALER: '/wholesaler/dashboard',
      B2C_SELLER: '/seller/dashboard',
      SELLER: '/seller/dashboard',
      ADMIN: '/admin/dashboard',
      PROCUREMENT: '/procurement/dashboard',
      FULFILLMENT: '/fulfillment/dashboard',
      CATALOG: '/catalog/dashboard',
      MARKETING: '/marketing/dashboard',
      FINANCE: '/finance/dashboard',
      CMS_EDITOR: '/cms/dashboard',
    };

    return roleDashboardMap[currentRole] || '/';
  };

  const ROLE_LABELS: Record<UserRole, string> = {
    CUSTOMER: 'Customer',
    WHOLESALER: 'Wholesaler',
    B2C_SELLER: 'B2C Seller',
    SELLER: 'Seller',
    ADMIN: 'Admin',
    PROCUREMENT: 'Procurement',
    FULFILLMENT: 'Fulfillment',
    CATALOG: 'Catalog',
    MARKETING: 'Marketing',
    FINANCE: 'Finance',
    CMS_EDITOR: 'CMS Editor',
  };

  const handleLogout = async () => {
    await logout();
  };

  const handleBackToAdmin = () => {
    switchRole(null);
    // Navigate to admin dashboard
    if (typeof window !== 'undefined') {
      window.location.href = '/admin/dashboard';
    }
  };

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
          <nav className="hidden md:flex items-center space-x-4 lg:space-x-6">
            {/* Hide Products/Fandoms/Cart on dashboard pages */}
            {!isDashboardPage && (
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
                <Link 
                  href="/cart" 
                  className="text-sm lg:text-base text-purple-700 hover:text-amber-600 font-medium font-secondary transition-colors duration-300"
                >
                  Cart
                </Link>
                <Link 
                  href="/help" 
                  className="text-sm lg:text-base text-purple-700 hover:text-amber-600 font-medium font-secondary transition-colors duration-300"
                >
                  Help
                </Link>
                <CurrencySelector />
              </>
            )}
            {isAuthenticated && user ? (
              <>
                {/* Dashboard link for authenticated users */}
                <Link
                  href={getDashboardLink()}
                  className="text-sm lg:text-base text-purple-700 hover:text-amber-600 font-medium font-secondary transition-colors duration-300"
                >
                  Dashboard
                </Link>
                {/* Role Switcher - Show on all dashboards when admin is logged in */}
                {user.role === 'ADMIN' && isDashboardPage && (
                  <RoleSwitcher />
                )}
                {/* Back to Admin button when impersonating - Only show if RoleSwitcher is not visible */}
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
                <span className="text-sm lg:text-base text-purple-700 font-medium">
                  {user.email}
                </span>
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
          <nav className="md:hidden pb-4 border-t border-purple-200 mt-2 pt-4">
            <div className="flex flex-col space-y-3">
              {/* Hide Products/Fandoms/Cart on dashboard pages */}
              {!isDashboardPage && (
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
                  <Link 
                    href="/cart" 
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-base text-purple-700 hover:text-amber-600 font-medium font-secondary transition-colors duration-300 py-2 px-2 rounded-lg hover:bg-purple-50"
                  >
                    Cart
                  </Link>
                  <Link 
                    href="/help" 
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-base text-purple-700 hover:text-amber-600 font-medium font-secondary transition-colors duration-300 py-2 px-2 rounded-lg hover:bg-purple-50"
                  >
                    Help
                  </Link>
                  <div className="px-2 py-2">
                    <CurrencySelector />
                  </div>
                </>
            )}
              {isAuthenticated && user ? (
                <>
                  <Link
                    href={getDashboardLink()}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-base text-purple-700 hover:text-amber-600 font-medium font-secondary transition-colors duration-300 py-2 px-2 rounded-lg hover:bg-purple-50"
                  >
                    Dashboard
                  </Link>
                  {/* Role Switcher for mobile */}
                  {user.role === 'ADMIN' && isDashboardPage && (
                    <div className="px-2">
                      <RoleSwitcher />
                    </div>
                  )}
                  {/* Back to Admin button when impersonating - Only show if RoleSwitcher is not visible */}
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
                  <div className="px-4 py-2 text-base text-purple-700 font-medium">
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


