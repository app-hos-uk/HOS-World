'use client';

import { useMemo } from 'react';
import { AppShellLayout } from '@/components/AppShellLayout';
import { useAuth } from '@/contexts/AuthContext';
import { getAdminMenuItems, ZONE_LABELS } from '@/lib/adminMenus';

const ROLE_DASHBOARD: Record<string, string> = {
  CATALOG: '/catalog/dashboard',
  PROCUREMENT: '/procurement/dashboard',
  MARKETING: '/marketing/dashboard',
  FINANCE: '/finance/dashboard',
  FULFILLMENT: '/fulfillment/dashboard',
  CMS_EDITOR: '/cms/dashboard',
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  const { user, effectiveRole } = useAuth();
  const role = String(effectiveRole ?? user?.role ?? '');
  const menuItems = getAdminMenuItems(String(user?.role ?? ''), role);

  const dashboardHref = useMemo(
    () => ROLE_DASHBOARD[role.toUpperCase()] ?? '/admin/dashboard',
    [role],
  );

  return (
    <AppShellLayout
      title="Admin Panel"
      menuItems={menuItems}
      role="ADMIN"
      breadcrumbs="admin"
      search
      zoneLabels={ZONE_LABELS}
      errorBoundary
      persistSidebarScroll
      showUserAvatar
      headerLink={{ title: 'Dashboard', href: dashboardHref }}
      logoutDescription="You will need to sign in again to access the admin panel."
    >
      {children}
    </AppShellLayout>
  );
}
