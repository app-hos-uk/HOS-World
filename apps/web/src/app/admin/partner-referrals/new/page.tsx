'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { FIELD_CLASS, PRIMARY_BTN, SECONDARY_BTN, entityId } from '../_shared';

export default function AdminPartnerReferralNewPage() {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState('');
  const [type, setType] = useState('EXTERNAL');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [description, setDescription] = useState('');
  const [contractStart, setContractStart] = useState('');
  const [contractEnd, setContractEnd] = useState('');
  const [brandPartnershipId, setBrandPartnershipId] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (type === 'BRAND_PARTNER' && !brandPartnershipId.trim()) {
      toast.error('Brand partnership ID is required for BRAND_PARTNER');
      return;
    }
    setSaving(true);
    try {
      const r = await apiClient.adminCreatePartnerReferral({
        name: name.trim(),
        type,
        contactName: contactName.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        description: description.trim() || undefined,
        brandPartnershipId: type === 'BRAND_PARTNER' ? brandPartnershipId.trim() : undefined,
        contractStart: contractStart ? new Date(contractStart).toISOString() : undefined,
        contractEnd: contractEnd ? new Date(contractEnd).toISOString() : undefined,
      });
      const id = entityId(r.data) ?? entityId(r);
      toast.success('Partner created');
      router.push(id ? `/admin/partner-referrals/${id}` : '/admin/partner-referrals');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to create partner');
    } finally {
      setSaving(false);
    }
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <div className="p-6 max-w-xl mx-auto text-stone-100 space-y-4">
        <Link href="/admin/partner-referrals" className="text-sm text-amber-200 font-secondary hover:text-amber-100">
          ← Back
        </Link>
        <h1 className="font-primary text-2xl text-amber-100">New Referral Partner</h1>

        <div className="bg-stone-900 border border-stone-800 rounded-lg p-6 space-y-4">
          <label className="block text-sm font-secondary">
            <span className="text-stone-300">Name <span className="text-red-400">*</span></span>
            <input className={FIELD_CLASS} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block text-sm font-secondary">
            <span className="text-stone-300">Type</span>
            <select className={FIELD_CLASS} value={type} onChange={(e) => setType(e.target.value)}>
              <option value="EXTERNAL">EXTERNAL</option>
              <option value="BRAND_PARTNER">BRAND_PARTNER</option>
            </select>
          </label>
          {type === 'BRAND_PARTNER' && (
            <label className="block text-sm font-secondary">
              <span className="text-stone-300">
                Brand partnership ID <span className="text-red-400">*</span>
              </span>
              <input
                className={FIELD_CLASS}
                value={brandPartnershipId}
                onChange={(e) => setBrandPartnershipId(e.target.value)}
                placeholder="UUID of an existing brand partnership"
              />
            </label>
          )}
          <label className="block text-sm font-secondary">
            <span className="text-stone-300">Contact name</span>
            <input className={FIELD_CLASS} value={contactName} onChange={(e) => setContactName(e.target.value)} />
          </label>
          <label className="block text-sm font-secondary">
            <span className="text-stone-300">Contact email</span>
            <input
              type="email"
              className={FIELD_CLASS}
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />
          </label>
          <label className="block text-sm font-secondary">
            <span className="text-stone-300">Description</span>
            <textarea
              className={FIELD_CLASS}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label className="block text-sm font-secondary">
            <span className="text-stone-300">Contract start</span>
            <input type="date" className={FIELD_CLASS} value={contractStart} onChange={(e) => setContractStart(e.target.value)} />
          </label>
          <label className="block text-sm font-secondary">
            <span className="text-stone-300">Contract end</span>
            <input type="date" className={FIELD_CLASS} value={contractEnd} onChange={(e) => setContractEnd(e.target.value)} />
          </label>
          <div className="flex gap-2 pt-2">
            <button type="button" disabled={saving} onClick={() => void save()} className={PRIMARY_BTN}>
              {saving ? 'Saving…' : 'Create'}
            </button>
            <Link href="/admin/partner-referrals" className={SECONDARY_BTN}>
              Cancel
            </Link>
          </div>
        </div>
      </div>
    </RouteGuard>
  );
}
