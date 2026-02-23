import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://hos-marketplaceweb-production.up.railway.app';
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/seller/', '/wholesaler/', '/finance/', '/fulfillment/', '/marketing/', '/procurement/', '/catalog/', '/checkout/', '/api/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
