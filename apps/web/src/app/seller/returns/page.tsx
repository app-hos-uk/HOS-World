'use client';

import { RouteGuard } from '@/components/RouteGuard';
import { DashboardLayout } from '@/components/DashboardLayout';
import { ReturnsManagement } from '@/components/returns/ReturnsManagement';
import { useAuth } from '@/contexts/AuthContext';
import { getSellerMenuItems } from '@/lib/sellerMenu';

export default function SellerReturnsPage() {
  const { user } = useAuth();
  const isWholesaler = user?.role === 'WHOLESALER';
  const menuItems = getSellerMenuItems(isWholesaler);

  return (
    <RouteGuard allowedRoles={['SELLER', 'B2C_SELLER', 'WHOLESALER', 'ADMIN']} showAccessDenied>
      <DashboardLayout role={isWholesaler ? 'WHOLESALER' : 'SELLER'} menuItems={menuItems} title={isWholesaler ? 'Wholesaler' : 'Seller'}>
        <ReturnsManagement mode="seller" />
      </DashboardLayout>
    </RouteGuard>
  );
}
