import type { Metadata } from 'next';
import SellerStorefrontClient from './SellerStorefrontClient';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://hos-marketplaceapi-production.up.railway.app';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://hos-marketplaceweb-production.up.railway.app';

async function fetchSeller(slug: string) {
  try {
    const res = await fetch(`${API_BASE}/api/sellers/slug/${slug}`, {
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
  params: { slug: string };
}): Promise<Metadata> {
  const { slug } = params;
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

export default function SellerStorefrontPage() {
  return <SellerStorefrontClient />;
}
