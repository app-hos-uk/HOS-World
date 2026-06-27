import type { Metadata } from 'next';
import ProductDetailClient from './ProductDetailClient';
import { ProductStructuredData } from '@/components/analytics/StructuredData';
import { getApiBaseForServer, getSiteUrl } from '@/lib/siteUrls';

const API_BASE = getApiBaseForServer();
const SITE_URL = getSiteUrl();

async function fetchProduct(idOrSlug: string) {
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idOrSlug);
    const endpoint = isUuid
      ? `${API_BASE}/products/${idOrSlug}`
      : `${API_BASE}/products/slug/${idOrSlug}`;
    const res = await fetch(endpoint, { 
      next: { revalidate: 60 },
      headers: {
        'Accept': 'application/json',
      },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data || null;
  } catch (error) {
    console.error('Failed to fetch product for metadata:', error);
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await fetchProduct(id);
  if (!product) {
    return { title: 'House of Spells | Product' };
  }

  const title = product.metaTitle || product.name || 'Product';
  const description =
    product.metaDescription ||
    product.shortDescription ||
    product.description?.slice(0, 160) ||
    `Shop ${title} at House of Spells`;
  const image = product.images?.[0]?.url;
  const canonicalPath = `/products/${product.slug || id}`;

  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      title,
      description,
      type: 'website',
      url: `${SITE_URL}${canonicalPath}`,
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

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await fetchProduct(id);
  const structuredDataPath = product?.slug || id;

  return (
    <>
      {product ? <ProductStructuredData product={product} pathId={structuredDataPath} /> : null}
      <ProductDetailClient />
    </>
  );
}
