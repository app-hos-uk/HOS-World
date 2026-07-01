'use client';

import { RouteGuard } from '@/components/RouteGuard';
import { DashboardLayout } from '@/components/DashboardLayout';
import { ReturnsManagement } from '@/components/returns/ReturnsManagement';
import { getSellerMenuItems } from '@/lib/sellerMenu';

export default function SellerReturnsPage() {
  const menuItems = getSellerMenuItems(false);

  return (
    <RouteGuard allowedRoles={['SELLER', 'B2C_SELLER', 'WHOLESALER', 'ADMIN']} showAccessDenied>
      <DashboardLayout role="SELLER" menuItems={menuItems} title="Seller">
        <ReturnsManagement mode="seller" />
      </DashboardLayout>
    </RouteGuard>
  );
}
