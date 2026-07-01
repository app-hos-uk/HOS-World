'use client';

import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { ReturnsManagement } from '@/components/returns/ReturnsManagement';

export default function AdminReturnsPage() {
  return (
    <RouteGuard allowedRoles={['ADMIN', 'FINANCE']}>
      <AdminLayout>
        <ReturnsManagement mode="admin" />
      </AdminLayout>
    </RouteGuard>
  );
}
