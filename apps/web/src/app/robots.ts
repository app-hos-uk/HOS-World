import { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/siteUrls';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getSiteUrl();
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/seller/',
          '/wholesaler/',
          '/finance/',
          '/fulfillment/',
          '/marketing/',
          '/procurement/',
          '/catalog/',
          '/cms/',
          '/customer/',
          '/checkout/',
          '/api/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
