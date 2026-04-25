import Link from 'next/link';
import { cookies } from 'next/headers';

const REF_COOKIE = 'hos_ref';
const MAX_AGE = 60 * 60 * 24 * 30;

export default async function ReferralLandingPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: raw } = await params;
  const code = decodeURIComponent(raw || '').trim();
  if (code) {
    const store = await cookies();
    store.set(REF_COOKIE, code, {
      path: '/',
      maxAge: MAX_AGE,
      sameSite: 'lax',
    });
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col items-center justify-center px-4">
      <h1 className="font-primary text-3xl text-amber-100 mb-4 text-center">The Enchanted Circle</h1>
      <p className="font-secondary text-stone-400 text-center max-w-md mb-8">
        You have been invited to join House of Spells loyalty. Create an account to earn bonus points when you shop.
      </p>
      <div className="flex flex-wrap gap-3 justify-center">
        <Link
          href={`/register?ref=${encodeURIComponent(code)}`}
          className="rounded-md bg-amber-600 px-5 py-2.5 text-stone-950 font-secondary font-medium hover:bg-amber-500"
        >
          Sign up
        </Link>
        <Link href="/" className="rounded-md border border-stone-600 px-5 py-2.5 font-secondary hover:bg-stone-900">
          Home
        </Link>
      </div>
      {code ? (
        <p className="mt-8 text-xs text-stone-600 font-secondary">Referral saved for 30 days.</p>
      ) : null}
    </div>
  );
}
