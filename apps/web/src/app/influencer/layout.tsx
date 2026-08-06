'use client';

import { RouteGuard } from '@/components/RouteGuard';
import { AppShellLayout } from '@/components/AppShellLayout';
import { navIcon } from '@/lib/navIcons';

const menuItems = [
  { title: 'Dashboard', href: '/influencer/dashboard', icon: navIcon('dashboard') },
  { title: 'Earnings', href: '/influencer/earnings', icon: navIcon('dollar') },
  { title: 'Product Links', href: '/influencer/product-links', icon: navIcon('link') },
  { title: 'Profile', href: '/influencer/profile', icon: navIcon('user') },
  { title: 'Storefront', href: '/influencer/storefront', icon: navIcon('shoppingBag') },
];

export default function InfluencerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RouteGuard allowedRoles={['INFLUENCER', 'ADMIN']} showAccessDenied={true}>
      <AppShellLayout role="INFLUENCER" menuItems={menuItems} title="Influencer" backToAdmin={{ title: 'Admin Dashboard', href: '/admin/dashboard' }} breadcrumbs="inline">
        {children}
      </AppShellLayout>
    </RouteGuard>
  );
}
