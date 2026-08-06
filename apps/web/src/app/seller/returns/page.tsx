'use client';

import { RouteGuard } from '@/components/RouteGuard';
import { AppShellLayout } from '@/components/AppShellLayout';
import { ReturnsManagement } from '@/components/returns/ReturnsManagement';
import { useAuth } from '@/contexts/AuthContext';
import { getSellerMenuItems } from '@/lib/sellerMenu';

export default function SellerReturnsPage() {
  const { user } = useAuth();
  const isWholesaler = user?.role === 'WHOLESALER';
  const menuItems = getSellerMenuItems(isWholesaler);

  return (
    <RouteGuard allowedRoles={['SELLER', 'B2C_SELLER', 'WHOLESALER', 'ADMIN']} showAccessDenied>
      <AppShellLayout role={isWholesaler ? 'WHOLESALER' : 'SELLER'} menuItems={menuItems} title={isWholesaler ? 'Wholesaler' : 'Seller'} breadcrumbs="inline">
        <ReturnsManagement mode="seller" />
      </AppShellLayout>
    </RouteGuard>
  );
}
