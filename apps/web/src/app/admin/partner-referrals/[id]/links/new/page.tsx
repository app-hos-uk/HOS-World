'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { TrackedLinkForm } from '../../../TrackedLinkForm';
import { entityId } from '../../../_shared';

export default function AdminPartnerReferralLinkNewPage() {
  const params = useParams();
  const partnerId = String(params.id);
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  const save = async (body: Record<string, unknown>) => {
    if (!body.name || !body.utmSource) {
      toast.error('Name and UTM source are required');
      return;
    }
    setSaving(true);
    try {
      const r = await apiClient.adminCreatePartnerReferralLink(partnerId, body);
      const linkId = entityId(r.data) ?? entityId(r);
      toast.success('Tracked link created');
      router.push(
        linkId
          ? `/admin/partner-referrals/links/${linkId}`
          : `/admin/partner-referrals/${partnerId}`,
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to create link');
    } finally {
      setSaving(false);
    }
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <div className="p-6 max-w-3xl mx-auto text-stone-100 space-y-4">
        <Link
          href={`/admin/partner-referrals/${partnerId}`}
          className="text-sm text-amber-200 font-secondary hover:text-amber-100"
        >
          ← Partner
        </Link>
        <h1 className="font-primary text-2xl text-amber-100">Create Tracked Link</h1>
        <TrackedLinkForm
          submitting={saving}
          onSubmit={(body) => void save(body)}
          onCancel={() => router.push(`/admin/partner-referrals/${partnerId}`)}
        />
      </div>
    </RouteGuard>
  );
}
