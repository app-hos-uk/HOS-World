import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import SellerStorefrontClient from './SellerStorefrontClient';
import { getApiBaseForServer, getSiteUrl } from '@/lib/siteUrls';

const API_BASE = getApiBaseForServer();
const SITE_URL = getSiteUrl();

async function fetchSeller(slug: string) {
  try {
    const res = await fetch(`${API_BASE}/sellers/slug/${encodeURIComponent(slug)}`, {
      next: { revalidate: 600 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data || null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const seller = await fetchSeller(slug);
  if (!seller) {
    return { title: 'Seller Not Found' };
  }

  const title = `${seller.storeName} — House of Spells Marketplace`;
  const description =
    seller.description?.slice(0, 160) || `Shop from ${seller.storeName} on House of Spells`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      url: `${SITE_URL}/sellers/${slug}`,
      images: seller.logo ? [{ url: seller.logo, alt: seller.storeName }] : [],
    },
  };
}

export default async function SellerStorefrontPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const seller = await fetchSeller(slug);
  if (!seller) {
    notFound();
  }

  return <SellerStorefrontClient />;
}
