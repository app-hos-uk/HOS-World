import type { Metadata } from 'next';
import ProductDetailClient from './ProductDetailClient';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://hos-marketplaceapi-production.up.railway.app';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://hos-marketplaceweb-production.up.railway.app';

async function fetchProduct(idOrSlug: string) {
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idOrSlug);
    const endpoint = isUuid
      ? `${API_BASE}/api/products/${idOrSlug}`
      : `${API_BASE}/api/products/slug/${idOrSlug}`;
    const res = await fetch(endpoint, { next: { revalidate: 300 } });
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
  params: { id: string };
}): Promise<Metadata> {
  const { id } = params;
  const product = await fetchProduct(id);
  if (!product) {
    return { title: 'Product Not Found' };
  }

  const title = product.name || 'Product';
  const description =
    product.shortDescription || product.description?.slice(0, 160) || `Shop ${title} at House of Spells`;
  const image = product.images?.[0]?.url;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      url: `${SITE_URL}/products/${id}`,
      images: image ? [{ url: image, width: 800, height: 800, alt: title }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: image ? [image] : [],
    },
    other: {
      'product:price:amount': product.price?.toString() || '',
      'product:price:currency': product.currency || 'USD',
    },
  };
}

export default function ProductDetailPage() {
  return <ProductDetailClient />;
}
