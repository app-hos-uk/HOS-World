'use client';

import { StaffLoyaltyEnrollForm } from '@/components/store/StaffLoyaltyEnrollForm';

export default function StoreEnrollPage() {
  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-hos-text-secondary">Enroll walk-in</h1>
        <p className="text-sm text-hos-text-muted mt-1">
          Create an Enchanted Circle membership for a customer at the till. If they already have an
          account, they will be enrolled against that email.
        </p>
      </div>
      <div className="rounded-lg border border-hos-border bg-hos-bg-secondary p-4">
        <StaffLoyaltyEnrollForm />
      </div>
    </div>
  );
}
