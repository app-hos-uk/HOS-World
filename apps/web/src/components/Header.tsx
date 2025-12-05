'use client';

import Link from 'next/link';
import { useTheme } from '@hos-marketplace/theme-system';
import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { useRouter } from 'next/navigation';

export function Header() {
  const theme = useTheme();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  // Check if user is logged in
  useEffect(() => {
    const checkAuth = async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (token) {
        setIsLoggedIn(true);
        // Try to get user info
        try {
          const response = await apiClient.getCurrentUser();
          if (response?.data?.email) {
            setUserEmail(response.data.email);
          }
        } catch (error) {
          // If token is invalid, clear it
          localStorage.removeItem('auth_token');
          setIsLoggedIn(false);
        }
      } else {
        setIsLoggedIn(false);
      }
    };
    
    checkAuth();
    
    // Listen for storage changes (when login happens in another tab/window)
    const handleStorageChange = () => {
      checkAuth();
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleLogout = async () => {
    try {
      await apiClient.logout();
    } catch (error) {
      // Ignore logout errors
    }
    localStorage.removeItem('auth_token');
    setIsLoggedIn(false);
    setUserEmail(null);
    router.push('/');
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
            {isLoggedIn ? (
              <>
                <span className="text-sm lg:text-base text-purple-700 font-medium">
                  {userEmail || 'User'}
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
              {isLoggedIn ? (
                <>
                  <div className="px-4 py-2 text-base text-purple-700 font-medium">
                    {userEmail || 'User'}
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


