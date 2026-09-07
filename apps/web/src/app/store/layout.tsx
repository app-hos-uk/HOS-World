'use client';

import { RouteGuard } from '@/components/RouteGuard';
import { AppShellLayout } from '@/components/AppShellLayout';
import { navIcon } from '@/lib/navIcons';
import type { UserRole } from '@hos-marketplace/shared-types';

// Both must stay referentially stable: RouteGuard and AppShellLayout key effects
// off these, and a fresh array each render re-triggers them on every paint.
const ALLOWED_ROLES: UserRole[] = ['STORE_STAFF', 'ADMIN'];

const menuItems = [
  { title: 'Dashboard', href: '/store', icon: navIcon('home'), exactMatch: true },
  { title: 'Ship purchase', href: '/store/shipping', icon: navIcon('truck'), exactMatch: true },
  { title: 'Pending customers', href: '/store/shipping/pending-queue', icon: navIcon('clock') },
  { title: 'Back office packing', href: '/store/shipping/backoffice', icon: navIcon('package') },
  { title: 'Customer Lookup', href: '/store/lookup', icon: navIcon('search') },
  { title: 'Enroll member', href: '/store/enroll', icon: navIcon('idCard') },
];

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard allowedRoles={ALLOWED_ROLES} showAccessDenied>
      <AppShellLayout
        role="STORE_STAFF"
        menuItems={menuItems}
        title="Store"
        showUserAvatar
        backToAdmin={{ title: 'Admin Dashboard', href: '/admin/dashboard' }}
        logoutDescription="You will need to sign in again to look up members or redeem vouchers."
      >
        {children}
      </AppShellLayout>
    </RouteGuard>
  );
}
