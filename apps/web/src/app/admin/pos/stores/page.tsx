'use client';

import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';

export default function AdminPosStoresPage() {
  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="space-y-6">
          <Link href="/admin/pos" className="text-sm text-hos-gold hover:text-hos-gold">
            ← POS home
          </Link>
          <h1 className="text-2xl font-bold text-hos-text-secondary">Outlet management</h1>
          <p className="max-w-2xl text-hos-text-secondary">
            HOS stores are defined in the platform tenant model. Link each store&apos;s{' '}
            <strong>code</strong> to your webhook path and set <strong>externalOutletId</strong> on the
            POS connection after fetching outlets from the provider (Test → Outlets API).
          </p>
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
            Use <strong>POST /admin/pos/connections/:id/outlets</strong> from the API client or Swagger
            to list Lightspeed outlets, then update the connection with the correct{' '}
            <code className="rounded bg-amber-500/15 px-1">externalOutletId</code>.
          </div>
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
