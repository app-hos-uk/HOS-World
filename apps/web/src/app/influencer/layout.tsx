'use client';

import { RouteGuard } from '@/components/RouteGuard';

export default function InfluencerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RouteGuard allowedRoles={['INFLUENCER', 'ADMIN']} showAccessDenied={true}>
      {children}
    </RouteGuard>
  );
}
