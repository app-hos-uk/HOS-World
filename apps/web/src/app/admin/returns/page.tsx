'use client';

import { RouteGuard } from '@/components/RouteGuard';
import { ReturnsManagement } from '@/components/returns/ReturnsManagement';

export default function AdminReturnsPage() {
  return (
    <RouteGuard allowedRoles={['ADMIN', 'FINANCE']}>
              <ReturnsManagement mode="admin" />
          </RouteGuard>
  );
}
