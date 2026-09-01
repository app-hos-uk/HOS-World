'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import type { UserRole } from '@hos-marketplace/shared-types';

interface RouteGuardProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
  /** Optional: also require one of these permissions (checked via access control profile) */
  requiredPermissions?: string[];
  redirectTo?: string;
  showAccessDenied?: boolean;
}

export function RouteGuard({ 
  children, 
  allowedRoles, 
  requiredPermissions,
  redirectTo = '/login',
  showAccessDenied = false 
}: RouteGuardProps) {
  const { user, loading, isAuthenticated, effectiveRole, hasPermission } = useAuth();
  const router = useRouter();

  const currentRole = effectiveRole || user?.role;
  const isActualAdmin = user?.role === 'ADMIN';
  const hasRequiredRole = currentRole
    ? allowedRoles.includes(currentRole) || isActualAdmin
    : false;
  const hasRequiredPermission =
    !requiredPermissions?.length ||
    isActualAdmin ||
    requiredPermissions.some((p) => hasPermission(p));

  const allowed = hasRequiredRole && hasRequiredPermission;

  useEffect(() => {
    if (loading) return;

    if (!isAuthenticated || !user) {
      router.push(redirectTo);
      return;
    }

    if (!allowed) {
      if (showAccessDenied) {
        router.push('/access-denied');
      } else {
        const roleRedirectMap: Record<UserRole, string> = {
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
          SALES: '/',
          STORE_STAFF: '/store/lookup',
        } as Record<UserRole, string>;

        const defaultRedirect = (currentRole && roleRedirectMap[currentRole]) || '/';
        router.push(defaultRedirect);
      }
    }
  }, [user, loading, isAuthenticated, allowed, router, redirectTo, showAccessDenied, currentRole]);

  if (loading) {
    return (
      <div className="min-h-screen bg-hos-bg-secondary flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-hos-border border-t-hos-gold mx-auto"></div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user || !allowed) {
    return null;
  }

  return <>{children}</>;
}

