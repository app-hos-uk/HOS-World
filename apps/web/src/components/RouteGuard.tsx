'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import type { UserRole } from '@hos-marketplace/shared-types';

interface RouteGuardProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
  redirectTo?: string;
  showAccessDenied?: boolean;
}

export function RouteGuard({ 
  children, 
  allowedRoles, 
  redirectTo = '/login',
  showAccessDenied = false 
}: RouteGuardProps) {
  const { user, loading, isAuthenticated, effectiveRole } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return; // Wait for auth check to complete

    if (!isAuthenticated || !user) {
      // Not authenticated - redirect to login
      router.push(redirectTo);
      return;
    }

    // Check if user has required role
    // Use effective role (impersonated if set, otherwise actual role)
    const currentRole = effectiveRole || user.role;
    // ADMIN role has access to all dashboards, but only if not impersonating
    const isActualAdmin = user.role === 'ADMIN';
    const hasRequiredRole = allowedRoles.includes(currentRole) || (isActualAdmin && !effectiveRole);

    if (!hasRequiredRole) {
      if (showAccessDenied) {
        // Show access denied page instead of redirecting
        router.push('/access-denied');
      } else {
        // Redirect based on effective role
        const roleRedirectMap: Record<UserRole, string> = {
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
          CMS_EDITOR: '/',
        };

        const defaultRedirect = roleRedirectMap[currentRole] || '/';
        router.push(defaultRedirect);
      }
    }
  }, [user, loading, isAuthenticated, allowedRoles, router, redirectTo, showAccessDenied, pathname, effectiveRole]);

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show nothing while redirecting
  if (!isAuthenticated || !user) {
    return null;
  }

  // Check if user has required role
  // Use effective role (impersonated if set, otherwise actual role)
  const currentRole = effectiveRole || user.role;
  // ADMIN role has access to all dashboards, but only if not impersonating
  const isActualAdmin = user.role === 'ADMIN';
  const hasRequiredRole = allowedRoles.includes(currentRole) || (isActualAdmin && !effectiveRole);

  if (!hasRequiredRole) {
    return null; // Will redirect in useEffect
  }

  // User is authenticated and has required role
  return <>{children}</>;
}

