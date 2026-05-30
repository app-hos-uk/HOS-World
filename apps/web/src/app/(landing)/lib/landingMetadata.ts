import type { Metadata } from 'next';

const DEFAULT_OG_IMAGE = '/landing/hos-logo.jpg';

export function landingPageMetadata(options: {
  title: string;
  description: string;
  path: string;
  ogImage?: string;
}): Metadata {
  const image = options.ogImage ?? DEFAULT_OG_IMAGE;

  return {
    title: { absolute: options.title },
    description: options.description,
    alternates: { canonical: options.path },
    robots: { index: true, follow: true },
    openGraph: {
      siteName: 'House of Spells',
      title: options.title,
      description: options.description,
      type: 'website',
      url: options.path,
      locale: 'en_GB',
      images: [{ url: image, width: 1080, height: 1080, alt: 'House of Spells' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: options.title,
      description: options.description,
      images: [image],
    },
  };
}
