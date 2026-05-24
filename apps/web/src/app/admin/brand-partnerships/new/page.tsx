'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

const containsLetter = (str: string) => /[a-zA-Z]/.test(str);
const sanitizeNameInput = (value: string) => value.replace(/[^a-zA-Z\s\-'.&]/g, '');

export default function AdminBrandPartnershipNewPage() {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [description, setDescription] = useState('');
  const [contractStart, setContractStart] = useState('');
  const [contractEnd, setContractEnd] = useState('');
  const [totalBudget, setTotalBudget] = useState('10000');
  const [saving, setSaving] = useState(false);

  const nameError = name.trim() && !containsLetter(name) ? 'Name must contain at least one letter' : '';
  const contactNameError = contactName.trim() && !containsLetter(contactName) ? 'Contact name must contain at least one letter' : '';

  const save = async () => {
    if (!name.trim() || !contractStart || !contractEnd) {
      toast.error('Name and contract dates required');
      return;
    }
    if (!containsLetter(name)) {
      toast.error('Name must contain at least one letter');
      return;
    }
    if (contactName.trim() && !containsLetter(contactName)) {
      toast.error('Contact name must contain at least one letter');
      return;
    }
    setSaving(true);
    try {
      const r = await apiClient.adminCreateBrandPartnership({
        name: name.trim(),
        contactName: contactName.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        description: description.trim() || undefined,
        contractStart: new Date(contractStart).toISOString(),
        contractEnd: new Date(contractEnd).toISOString(),
        totalBudget: parseFloat(totalBudget) || 0,
      });
      const id = (r.data as Record<string, unknown>)?.id;
      toast.success('Created');
      router.push(id ? `/admin/brand-partnerships/${id}` : '/admin/brand-partnerships');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="p-6 max-w-xl mx-auto space-y-4">
          <Link href="/admin/brand-partnerships" className="text-violet-700 text-sm">
            ← Back
          </Link>
          <h1 className="text-2xl font-semibold text-white">New brand partner</h1>
          <label className="block text-sm">
            <span className="text-hos-text-secondary">Name <span className="text-red-500">*</span></span>
            <input
              className={`mt-1 w-full border rounded px-3 py-2 ${nameError ? 'border-red-300 focus:border-red-500' : 'border-hos-border'}`}
              value={name}
              onChange={(e) => setName(sanitizeNameInput(e.target.value))}
              placeholder="Enter brand/partner name"
            />
            {nameError && <p className="text-xs text-red-600 mt-1">{nameError}</p>}
          </label>
          <label className="block text-sm">
            <span className="text-hos-text-secondary">Contact name</span>
            <input
              className={`mt-1 w-full border rounded px-3 py-2 ${contactNameError ? 'border-red-300 focus:border-red-500' : 'border-hos-border'}`}
              value={contactName}
              onChange={(e) => setContactName(sanitizeNameInput(e.target.value))}
              placeholder="Enter contact person's name"
            />
            {contactNameError && <p className="text-xs text-red-600 mt-1">{contactNameError}</p>}
          </label>
          <label className="block text-sm">
            <span className="text-hos-text-secondary">Contact email</span>
            <input
              type="email"
              className="mt-1 w-full border rounded px-3 py-2"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-hos-text-secondary">Description</span>
            <textarea
              className="mt-1 w-full border rounded px-3 py-2"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-hos-text-secondary">Contract start</span>
            <input
              type="date"
              className="mt-1 w-full border rounded px-3 py-2"
              value={contractStart}
              onChange={(e) => setContractStart(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-hos-text-secondary">Contract end</span>
            <input
              type="date"
              className="mt-1 w-full border rounded px-3 py-2"
              value={contractEnd}
              onChange={(e) => setContractEnd(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-hos-text-secondary">Total budget</span>
            <input
              type="number"
              className="mt-1 w-full border rounded px-3 py-2"
              value={totalBudget}
              onChange={(e) => setTotalBudget(e.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="rounded-md bg-violet-700 px-4 py-2 text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Create'}
          </button>
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
