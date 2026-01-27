'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export default function AccessDeniedPage() {
  const { user, logout } = useAuth();

  const getDashboardLink = () => {
    if (!user) return '/';
    
    const roleDashboardMap: Record<string, string> = {
      CUSTOMER: '/customer/dashboard',
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

    return roleDashboardMap[user.role] || '/';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
        <div className="max-w-2xl mx-auto text-center">
          <div className="bg-white rounded-xl shadow-lg p-8 sm:p-12">
            <div className="mb-6">
              <svg
                className="mx-auto h-16 w-16 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Access Denied
            </h1>
            
            <p className="text-lg text-gray-600 mb-8">
              You don&apos;t have permission to access this page. This page is restricted to specific user roles.
            </p>

            {user && (
              <div className="mb-8 p-4 bg-purple-50 rounded-lg">
                <p className="text-sm text-gray-700 mb-2">
                  <span className="font-semibold">Current Role:</span> {user.role}
                </p>
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">Email:</span> {user.email}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href={getDashboardLink()}
                className="px-6 py-3 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white font-semibold rounded-lg transition-all duration-300"
              >
                Go to My Dashboard
              </Link>
              
              <Link
                href="/"
                className="px-6 py-3 bg-white border-2 border-purple-700 text-purple-700 hover:bg-purple-50 font-semibold rounded-lg transition-all duration-300"
              >
                Go to Home
              </Link>
              
              <button
                onClick={logout}
                className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-all duration-300"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

