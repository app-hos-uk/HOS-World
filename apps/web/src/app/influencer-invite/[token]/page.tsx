import { redirect } from 'next/navigation';

export default async function InfluencerInviteRedirectPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  redirect(
    `/auth/accept-invitation?token=${encodeURIComponent(token)}&type=influencer`,
  );
}
