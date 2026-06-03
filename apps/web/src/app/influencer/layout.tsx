'use client';

import { RouteGuard } from '@/components/RouteGuard';
import { DashboardLayout } from '@/components/DashboardLayout';

const menuItems = [
  { title: 'Dashboard', href: '/influencer/dashboard', icon: '📊' },
  { title: 'Earnings', href: '/influencer/earnings', icon: '💰' },
  { title: 'Product Links', href: '/influencer/product-links', icon: '🔗' },
  { title: 'Profile', href: '/influencer/profile', icon: '👤' },
  { title: 'Storefront', href: '/influencer/storefront', icon: '🛍️' },
];

export default function InfluencerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RouteGuard allowedRoles={['INFLUENCER', 'ADMIN']} showAccessDenied={true}>
      <DashboardLayout role="INFLUENCER" menuItems={menuItems} title="Influencer" backToHref={{ title: 'Admin Dashboard', href: '/admin/dashboard' }}>
        {children}
      </DashboardLayout>
    </RouteGuard>
  );
}
