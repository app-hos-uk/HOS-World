'use client';

import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';

export default function AdminPosStoresPage() {
  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="space-y-6">
          <Link href="/admin/pos" className="text-sm text-indigo-600 hover:text-indigo-800">
            ← POS home
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Outlet management</h1>
          <p className="max-w-2xl text-gray-600">
            HOS stores are defined in the platform tenant model. Link each store&apos;s{' '}
            <strong>code</strong> to your webhook path and set <strong>externalOutletId</strong> on the
            POS connection after fetching outlets from the provider (Test → Outlets API).
          </p>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Use <strong>POST /admin/pos/connections/:id/outlets</strong> from the API client or Swagger
            to list Lightspeed outlets, then update the connection with the correct{' '}
            <code className="rounded bg-amber-100 px-1">externalOutletId</code>.
          </div>
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
