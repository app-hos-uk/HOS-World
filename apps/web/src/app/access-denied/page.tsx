'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { getSellerMenuItems } from '@/lib/sellerMenu';

const ROLE_CONFIG: Record<string, { title: string; dashboardHref: string; menuItems: { title: string; href: string; icon: string }[] }> = {
  PROCUREMENT: {
    title: 'Procurement',
    dashboardHref: '/procurement/dashboard',
    menuItems: [
      { title: 'Dashboard', href: '/procurement/dashboard', icon: '📊' },
      { title: 'Review Submissions', href: '/procurement/submissions', icon: '📦' },
    ],
  },
  FULFILLMENT: {
    title: 'Fulfillment',
    dashboardHref: '/fulfillment/dashboard',
    menuItems: [
      { title: 'Dashboard', href: '/fulfillment/dashboard', icon: '📊' },
    ],
  },
  CATALOG: {
    title: 'Catalog',
    dashboardHref: '/catalog/dashboard',
    menuItems: [
      { title: 'Dashboard', href: '/catalog/dashboard', icon: '📊' },
    ],
  },
  MARKETING: {
    title: 'Marketing',
    dashboardHref: '/marketing/dashboard',
    menuItems: [
      { title: 'Dashboard', href: '/marketing/dashboard', icon: '📊' },
    ],
  },
  FINANCE: {
    title: 'Finance',
    dashboardHref: '/finance/dashboard',
    menuItems: [
      { title: 'Dashboard', href: '/finance/dashboard', icon: '📊' },
    ],
  },
  CMS_EDITOR: {
    title: 'CMS',
    dashboardHref: '/cms/dashboard',
    menuItems: [
      { title: 'Dashboard', href: '/cms/dashboard', icon: '📊' },
    ],
  },
  ADMIN: {
    title: 'Admin',
    dashboardHref: '/admin/dashboard',
    menuItems: [
      { title: 'Dashboard', href: '/admin/dashboard', icon: '📊' },
    ],
  },
  CUSTOMER: {
    title: 'Account',
    dashboardHref: '/customer/dashboard',
    menuItems: [
      { title: 'Dashboard', href: '/customer/dashboard', icon: '📊' },
    ],
  },
};

function getRoleConfig(role: string | undefined) {
  if (!role) return null;
  if (role === 'WHOLESALER') {
    return { title: 'Wholesaler', dashboardHref: '/wholesaler/dashboard', menuItems: getSellerMenuItems(true) };
  }
  if (role === 'SELLER' || role === 'B2C_SELLER') {
    return { title: 'Seller', dashboardHref: '/seller/dashboard', menuItems: getSellerMenuItems(false) };
  }
  return ROLE_CONFIG[role] || null;
}

export default function AccessDeniedPage() {
  const { user, logout } = useAuth();
  const config = getRoleConfig(user?.role);

  if (!config) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <div className="max-w-md text-center bg-white rounded-xl shadow-lg p-8">
          <svg className="mx-auto h-16 w-16 text-red-500 mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-6">You don&apos;t have permission to access this page.</p>
          <div className="flex flex-col gap-3">
            <Link href="/" className="px-6 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors">Go to Home</Link>
            <button onClick={logout} className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors">Logout</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout
      role={user?.role || 'CUSTOMER'}
      menuItems={config.menuItems}
      title={config.title}
    >
      <div className="max-w-2xl mx-auto py-8">
        <div className="bg-white rounded-xl shadow-lg p-8 sm:p-12 text-center">
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
              href={config.dashboardHref}
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
    </DashboardLayout>
  );
}
