import type { Metadata } from 'next';
import { getSiteUrl } from '../../lib/siteUrls';

const DEFAULT_OG_IMAGE_PATH = '/assets/logo-emblem.png';

export function landingPageMetadata(options: {
  title: string;
  description: string;
  path: string;
  ogImage?: string;
}): Metadata {
  const siteUrl = getSiteUrl();
  const imagePath = options.ogImage ?? DEFAULT_OG_IMAGE_PATH;
  const absoluteImage = imagePath.startsWith('http') ? imagePath : `${siteUrl}${imagePath}`;
  const absoluteUrl = `${siteUrl}${options.path}`;

  return {
    title: { absolute: options.title },
    description: options.description,
    alternates: { canonical: absoluteUrl },
    robots: { index: true, follow: true },
    openGraph: {
      siteName: 'House of Spells',
      title: options.title,
      description: options.description,
      type: 'website',
      url: absoluteUrl,
      locale: 'en_GB',
      images: [{ url: absoluteImage, width: 1080, height: 1080, alt: 'House of Spells' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: options.title,
      description: options.description,
      images: [absoluteImage],
    },
  };
}
