import { redirect } from 'next/navigation';
import { getSafeReturnUrl } from '@/lib/authRedirect';

/**
 * /account/addresses is linked from ship-home. Address CRUD lives on profile.
 */
export default async function AccountAddressesPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; returnUrl?: string }>;
}) {
  const q = await searchParams;
  const params = new URLSearchParams();
  params.set('tab', 'addresses');
  params.set('action', q.action === 'add' || q.action === 'edit' ? q.action : 'add');
  const returnUrl = getSafeReturnUrl(q.returnUrl);
  if (returnUrl) params.set('returnUrl', returnUrl);
  redirect(`/profile?${params.toString()}`);
}
