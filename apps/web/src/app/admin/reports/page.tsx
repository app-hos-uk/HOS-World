'use client';

import { RouteGuard } from '@/components/RouteGuard';
import Link from 'next/link';
import { navIcon } from '@/lib/navIcons';

const reportLinks = [
  { title: 'Sales Reports', href: '/admin/reports/sales', icon: navIcon('banknote', 'w-8 h-8'), description: 'Revenue, orders, and sales trends' },
  { title: 'User Analytics', href: '/admin/reports/users', icon: navIcon('users', 'w-8 h-8'), description: 'User growth and engagement' },
  { title: 'Product Analytics', href: '/admin/reports/products', icon: navIcon('package', 'w-8 h-8'), description: 'Product performance and catalog metrics' },
  { title: 'Platform Metrics', href: '/admin/reports/platform', icon: navIcon('trending', 'w-8 h-8'), description: 'Platform-wide KPIs and health' },
  { title: 'Inventory Reports', href: '/admin/reports/inventory', icon: navIcon('clipboard', 'w-8 h-8'), description: 'Stock levels and inventory trends' },
];

export default function AdminReportsPage() {
  return (
    <RouteGuard allowedRoles={['ADMIN']} showAccessDenied={true}>
              <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-hos-text-secondary">Reports</h1>
            <p className="mt-1 text-sm text-hos-text-muted">Analytics and report dashboards</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {reportLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-lg border border-hos-border bg-hos-bg-secondary p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <span className="text-3xl" role="img" aria-hidden>{item.icon}</span>
                <h2 className="mt-3 text-lg font-semibold text-hos-text-secondary">{item.title}</h2>
                <p className="mt-1 text-sm text-hos-text-muted">{item.description}</p>
                <span className="mt-3 inline-block text-sm font-medium text-hos-gold">View report →</span>
              </Link>
            ))}
          </div>
        </div>
          </RouteGuard>
  );
}
